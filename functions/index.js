// ---------------------------------------------------------------------------
// Cloud Functions do Sistema Vidraçaria Pro
// ---------------------------------------------------------------------------
// Por que isso precisa existir num servidor, e não só no navegador:
// Credenciais de banco (Client ID / Client Secret) NUNCA podem chegar ao
// navegador do usuário — qualquer pessoa com o DevTools aberto conseguiria
// roubá-las. Essas funções guardam e usam essas credenciais só aqui, no
// servidor, cifradas em repouso (ver crypto-helper.js), e o app web só
// conversa com elas por chamadas autenticadas.
//
// Isolamento entre usuários (multi-tenant SaaS):
// Em toda função, o "dono dos dados" é sempre `request.auth.uid` — o UID da
// sessão de login validada pelo próprio Firebase. Nunca confiamos em um
// tenantId enviado pelo cliente.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getProvider, PROVIDERS } = require('./providers');
const { encrypt, decrypt } = require('./crypto-helper');

const BOLETO_VAULT_KEY = defineSecret('BOLETO_VAULT_KEY');

// IMPORTANTE: a conexão com o Firestore é criada de forma "preguiçosa" (só na
// primeira vez que uma função realmente roda), não aqui no topo do arquivo.
// Fazer isso no topo trava o comando `firebase deploy` — durante o deploy, o
// Firebase carrega este arquivo só para descobrir quais funções existem, sem
// rodar nenhuma de verdade, e se essa etapa tentar abrir conexão com o banco
// nesse momento, ela pode travar esperando uma resposta que nunca chega
// (erro "Cannot determine backend specification. Timeout after 10000").
let _app;
let _db;
function getDb() {
  if (!_db) {
    if (!_app) _app = admin.initializeApp();
    // Aponta explicitamente para o banco de dados chamado "default" — mesmo
    // ajuste que já fizemos no app web (src/lib/firebase.ts). O Firestore
    // deste projeto foi criado com esse nome, em vez do banco reservado
    // especial que o SDK usa quando nenhum nome é informado.
    _db = getFirestore(_app, 'default');
  }
  return _db;
}

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Você precisa estar logado para usar esta função.');
  }
  return request.auth.uid;
}

// ---------------------------------------------------------------------------
// getBoletoProviders — lista de bancos que o servidor realmente sabe operar.
// ---------------------------------------------------------------------------
// A lista não fica fixa no app web de propósito: se ela morasse lá, um dia
// ofereceria um banco que o servidor ainda não sabe emitir, e a pessoa só
// descobriria isso na hora de cobrar o cliente de verdade.
exports.getBoletoProviders = onCall(async () => {
  const list = Object.entries(PROVIDERS).map(([id, mod]) => ({
    id,
    label: mod.label || id,
    implemented: !!mod.implemented,
    credentialFields: mod.credentialFields || [],
  }));
  return { providers: list };
});

// ---------------------------------------------------------------------------
// saveBoletoCredentials — grava as credenciais do banco no cofre do tenant.
// ---------------------------------------------------------------------------
// Cada banco pede um conjunto diferente de credenciais (Asaas: só uma Chave de
// API; Efí/Inter: Client ID + Client Secret + certificado digital). Em vez de
// um campo fixo por tipo, guardamos TUDO que é sensível como um único blob
// cifrado (JSON), cujo formato varia conforme `provider.credentialFields`
// (definido em cada arquivo de /providers). O documento em
// `boletoVaults/{tenantId}` é bloqueado nas regras do Firestore — só esta
// função, com privilégio de administrador, consegue tocar nele.
exports.saveBoletoCredentials = onCall({ secrets: [BOLETO_VAULT_KEY] }, async (request) => {
  const tenantId = requireAuth(request);
  const { provider, ambiente } = request.data || {};

  if (!provider || typeof provider !== 'string') {
    throw new HttpsError('invalid-argument', 'Informe qual provedor/banco está configurando.');
  }

  const providerMod = getProvider(provider);

  const existingSnap = await getDb().collection('boletoVaults').doc(tenantId).get();
  const existing = existingSnap.exists ? existingSnap.data() : null;
  const isSameProvider = existing && existing.provider === provider;

  // Descriptografa o que já existia (se for o mesmo provedor) para poder
  // aplicar o padrão "deixe em branco para manter o atual" campo a campo.
  let existingSecrets = {};
  if (isSameProvider && existing.secretsEnc) {
    try {
      existingSecrets = JSON.parse(decrypt(existing.secretsEnc));
    } catch (err) {
      throw new HttpsError(
        'failed-precondition',
        `Erro ao ler as credenciais já guardadas: ${err.message}. Verifique se a secret BOLETO_VAULT_KEY não mudou.`
      );
    }
  }

  // IMPORTANTE: os campos exigidos vêm de `providerMod.credentialFields` (ver
  // cada arquivo em /providers), NÃO de uma suposição fixa aqui. Isso evita
  // pedir coisa que um banco não precisa (ex: a API de Cobranças da Efí não
  // exige certificado, diferente do Pix dela ou do Banco Inter) — cada banco
  // declara exatamente o que precisa, e essa função só segue a receita.
  const fields = providerMod.credentialFields || [];
  const newSecrets = {};
  let finalClientId = null;

  for (const field of fields) {
    const incoming = request.data ? request.data[field.id] : undefined;
    const trimmedIncoming = typeof incoming === 'string' ? incoming.trim() : incoming;
    const finalValue = trimmedIncoming || existingSecrets[field.id] || '';

    if (!field.optional && !finalValue) {
      throw new HttpsError(
        'invalid-argument',
        `Informe o campo "${field.label}" para configurar o ${providerMod.label || provider}.`
      );
    }

    if (field.id === 'clientId') {
      // clientId não é segredo (é só um identificador) — fica em texto puro
      // no documento, fora do blob cifrado, só pra exibição/diagnóstico.
      finalClientId = finalValue || null;
    } else {
      newSecrets[field.id] = finalValue;
    }
  }

  let secretsEnc;
  try {
    secretsEnc = encrypt(JSON.stringify(newSecrets));
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      `Erro ao cifrar as credenciais: ${err.message}. Verifique se a secret BOLETO_VAULT_KEY foi configurada e publicada corretamente.`
    );
  }

  await getDb().collection('boletoVaults').doc(tenantId).set({
    provider,
    ambiente: ambiente === 'homologacao' ? 'homologacao' : 'producao',
    clientId: finalClientId,
    secretsEnc,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: existing?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  });

  // Status "público" (sem segredo nenhum) que o app web PODE ler, só pra saber
  // se já existe uma configuração e de qual provedor/ambiente, pra exibir na tela.
  const identificacaoBase = finalClientId || newSecrets.apiKey || '';
  await getDb().collection('tenants').doc(tenantId).collection('boletoConfig').doc('status').set({
    configured: true,
    provider,
    ambiente: ambiente === 'homologacao' ? 'homologacao' : 'producao',
    identificacao:
      identificacaoBase.length > 8
        ? `${identificacaoBase.slice(0, 4)}…${identificacaoBase.slice(-4)}`
        : identificacaoBase,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// removeBoletoCredentials — apaga as credenciais do cofre do tenant.
// ---------------------------------------------------------------------------
exports.removeBoletoCredentials = onCall(async (request) => {
  const tenantId = requireAuth(request);

  await getDb().collection('boletoVaults').doc(tenantId).delete();
  await getDb().collection('tenants').doc(tenantId).collection('boletoConfig').doc('status').set({
    configured: false,
    provider: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// issueBoleto — emite um boleto usando as credenciais guardadas no cofre.
// ---------------------------------------------------------------------------
exports.issueBoleto = onCall({ secrets: [BOLETO_VAULT_KEY] }, async (request) => {
  const tenantId = requireAuth(request);
  const {
    customerId,
    customerName,
    customerDocument, // CPF/CNPJ do pagador — exigido por boletos registrados
    customerAddress,  // { logradouro, numero, bairro, cidade, uf, cep }
    customerEmail,
    customerPhone,
    quoteId,
    quoteCodeNumber,
    amount,
    dueDate,
    description,
  } = request.data || {};

  if (!amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Informe um valor válido para o boleto.');
  }
  if (!dueDate) {
    throw new HttpsError('invalid-argument', 'Informe a data de vencimento do boleto.');
  }
  if (!customerName) {
    throw new HttpsError('invalid-argument', 'Informe o cliente para quem o boleto será emitido.');
  }

  const vaultSnap = await getDb().collection('boletoVaults').doc(tenantId).get();
  if (!vaultSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      'Nenhuma credencial de banco configurada ainda. Configure o Cofre de Boletos primeiro.'
    );
  }

  const vault = vaultSnap.data();
  const provider = getProvider(vault.provider);

  if (!provider.implemented) {
    throw new HttpsError(
      'failed-precondition',
      `A integração com ${provider.label || vault.provider} ainda não foi finalizada neste sistema.`
    );
  }

  // Descriptografa o segredo só neste instante, em memória, pelo tempo mínimo
  // necessário para repassar ao banco — nunca é logado nem devolvido ao cliente.
  let decryptedSecrets;
  try {
    decryptedSecrets = JSON.parse(decrypt(vault.secretsEnc));
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      `Erro ao decifrar as credenciais salvas: ${err.message}. Verifique se a secret BOLETO_VAULT_KEY foi configurada corretamente.`
    );
  }

  // Formato varia por banco: Asaas só tem apiKey; Efí/Inter têm clientId (em
  // texto no documento) + clientSecret/certificado (cifrados). Repassamos tudo
  // junto para o provedor, que usa só o que precisa.
  const credentials = {
    provider: vault.provider,
    ambiente: vault.ambiente,
    clientId: vault.clientId,
    ...decryptedSecrets,
  };

  let result;
  try {
    result = await provider.issueBoleto(credentials, {
      amount,
      dueDate,
      payerName: customerName,
      payerDocument: customerDocument || null,
      payerAddress: customerAddress || null,
      payerEmail: customerEmail || null,
      payerPhone: customerPhone || null,
      description: description || `Orçamento #${quoteCodeNumber || ''}`.trim(),
    });
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Falha ao emitir boleto junto ao banco.');
  }

  // Guarda um histórico do boleto emitido, isolado por tenant como todo o
  // resto do sistema (tenants/{tenantId}/boletos/{boletoId}).
  const boletoRecord = {
    id: result.boletoId,
    tenantId,
    customerId: customerId || null,
    customerName,
    quoteId: quoteId || null,
    quoteCodeNumber: quoteCodeNumber || null,
    amount,
    dueDate,
    description: description || null,
    provider: vault.provider,
    ambiente: vault.ambiente,
    simulated: !!result.simulated,
    status: result.status,
    barcode: result.barcode || null,
    boletoUrl: result.boletoUrl || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await getDb().collection('tenants').doc(tenantId).collection('boletos').doc(result.boletoId).set(boletoRecord);

  return { ok: true, ...result };
});
