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
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
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
// Multi-usuário por tenant (mestre + até 2 usuários com permissões).
// ---------------------------------------------------------------------------
// O primeiro usuário de uma conta é sempre o "mestre" — o próprio UID dele
// já É o tenantId, exatamente como sempre foi neste sistema (nenhuma conta
// mestre existente quebra com esta mudança).
//
// Usuários criados pelo mestre são contas de Firebase Authentication PRÓPRIAS
// (login/senha independentes), mas com uma Custom Claim gravada no token de
// login deles apontando pra QUAL tenant pertencem e quais permissões têm:
//   { tenantId: "<uid do mestre>", role: "member", permissions: {...} }
//
// Isso é o que permite ao Firestore recusar ou liberar acesso por permissão
// SEM precisar de leitura extra nenhuma nas regras — o token já carrega tudo.
const MAX_TEAM_MEMBERS = 2;

function emptyPermissions() {
  return { orcamentos: false, clientes: false, precos: false, boletos: false, estoque: false };
}

function sanitizePermissions(input) {
  const p = input || {};
  return {
    orcamentos: !!p.orcamentos,
    clientes: !!p.clientes,
    precos: !!p.precos,
    boletos: !!p.boletos,
    estoque: !!p.estoque,
  };
}

// Resolve o tenantId do usuário logado (mestre ou membro) e, opcionalmente,
// exige uma permissão específica quando for um membro — o mestre sempre tem
// acesso total, então nunca é bloqueado por essa checagem.
function requireTenantAccess(request, permission) {
  const uid = requireAuth(request);
  const token = request.auth.token || {};

  if (token.role === 'member') {
    if (!token.tenantId) {
      throw new HttpsError('permission-denied', 'Esta conta não está vinculada a nenhuma empresa.');
    }
    if (permission && !(token.permissions && token.permissions[permission])) {
      throw new HttpsError(
        'permission-denied',
        'Seu usuário não tem permissão para esta ação. Peça ao administrador da conta para liberar.'
      );
    }
    return token.tenantId;
  }

  return uid; // mestre — tenantId é o próprio UID
}

// Só o mestre pode gerenciar a equipe (criar/editar/remover usuários).
function requireMaster(request) {
  const uid = requireAuth(request);
  const token = request.auth.token || {};
  if (token.role === 'member') {
    throw new HttpsError('permission-denied', 'Apenas o usuário mestre pode gerenciar a equipe.');
  }
  return uid;
}

// ---------------------------------------------------------------------------
// listTeamMembers — lista os usuários da equipe (mestre + membros).
// ---------------------------------------------------------------------------
exports.listTeamMembers = onCall(async (request) => {
  const tenantId = requireTenantAccess(request);
  const snap = await getDb().collection('tenants').doc(tenantId).collection('teamMembers').get();
  const members = snap.docs.map((d) => d.data());
  return { members };
});

// ---------------------------------------------------------------------------
// createTeamMember — o mestre cria um novo usuário com permissões específicas.
// ---------------------------------------------------------------------------
exports.createTeamMember = onCall(async (request) => {
  const tenantId = requireMaster(request);
  const { name, email, password, permissions } = request.data || {};

  if (!name || !name.trim()) {
    throw new HttpsError('invalid-argument', 'Informe o nome do novo usuário.');
  }
  if (!email || !email.trim()) {
    throw new HttpsError('invalid-argument', 'Informe o e-mail do novo usuário.');
  }
  if (!password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'A senha precisa ter pelo menos 6 caracteres.');
  }

  const teamRef = getDb().collection('tenants').doc(tenantId).collection('teamMembers');
  const existingSnap = await teamRef.where('role', '==', 'member').get();
  if (existingSnap.size >= MAX_TEAM_MEMBERS) {
    throw new HttpsError(
      'resource-exhausted',
      `Limite de ${MAX_TEAM_MEMBERS} usuários adicionais atingido. Remova um usuário existente antes de criar outro.`
    );
  }

  const cleanPermissions = sanitizePermissions(permissions);
  const cleanEmail = email.trim().toLowerCase();

  let newUser;
  try {
    newUser = await admin.auth().createUser({
      email: cleanEmail,
      password,
      displayName: name.trim(),
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Já existe uma conta cadastrada com este e-mail.');
    }
    throw new HttpsError('internal', `Erro ao criar o usuário: ${err.message}`);
  }

  // A Custom Claim é o que realmente vincula esse login ao tenant certo e às
  // permissões dele — sem isso, o novo usuário logaria "sem tenant nenhum".
  await admin.auth().setCustomUserClaims(newUser.uid, {
    tenantId,
    role: 'member',
    permissions: cleanPermissions,
  });

  const memberDoc = {
    uid: newUser.uid,
    tenantId,
    name: name.trim(),
    email: cleanEmail,
    role: 'member',
    permissions: cleanPermissions,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await teamRef.doc(newUser.uid).set(memberDoc);

  return { ok: true, uid: newUser.uid };
});

// ---------------------------------------------------------------------------
// updateTeamMemberPermissions — o mestre altera nome/permissões de um membro.
// ---------------------------------------------------------------------------
exports.updateTeamMemberPermissions = onCall(async (request) => {
  const tenantId = requireMaster(request);
  const { memberUid, permissions, name } = request.data || {};

  if (!memberUid) {
    throw new HttpsError('invalid-argument', 'Informe qual usuário editar.');
  }

  const memberRef = getDb().collection('tenants').doc(tenantId).collection('teamMembers').doc(memberUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta equipe.');
  }

  const cleanPermissions = sanitizePermissions(permissions);

  // Regrava a Custom Claim inteira — trocas de permissão só valem pro membro
  // depois que o token dele atualizar (próximo login, ou até 1h de cache).
  await admin.auth().setCustomUserClaims(memberUid, {
    tenantId,
    role: 'member',
    permissions: cleanPermissions,
  });

  const update = {
    permissions: cleanPermissions,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (name && name.trim()) update.name = name.trim();

  await memberRef.set(update, { merge: true });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// removeTeamMember — o mestre remove um usuário da equipe.
// ---------------------------------------------------------------------------
exports.removeTeamMember = onCall(async (request) => {
  const tenantId = requireMaster(request);
  const { memberUid } = request.data || {};

  if (!memberUid) {
    throw new HttpsError('invalid-argument', 'Informe qual usuário remover.');
  }

  const memberRef = getDb().collection('tenants').doc(tenantId).collection('teamMembers').doc(memberUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta equipe.');
  }

  try {
    await admin.auth().deleteUser(memberUid);
  } catch (err) {
    // Se a conta já não existir mais na Autenticação, seguimos e limpamos o
    // registro mesmo assim — não faz sentido travar a remoção por causa disso.
    if (err.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', `Erro ao remover o usuário: ${err.message}`);
    }
  }

  await memberRef.delete();

  return { ok: true };
});

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
  // Configurar credenciais bancárias é mais sensível que só emitir boleto —
  // fica restrito ao mestre, mesmo que um membro tenha permissão de "boletos".
  const tenantId = requireMaster(request);
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

  // Token do webhook: gerado uma única vez por tenant e reaproveitado depois
  // (trocar de banco não muda o endereço de aviso já registrado no painel do
  // banco anterior). Não é a proteção real (essa vem da reconsulta ao banco
  // — ver boletoWebhook mais abaixo), é só um filtro contra ruído aleatório.
  const webhookToken = existing?.webhookToken || crypto.randomBytes(20).toString('hex');

  await getDb().collection('boletoVaults').doc(tenantId).set({
    provider,
    ambiente: ambiente === 'homologacao' ? 'homologacao' : 'producao',
    clientId: finalClientId,
    secretsEnc,
    webhookToken,
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
    webhookUrl: buildWebhookUrl(provider, tenantId, webhookToken),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// removeBoletoCredentials — apaga as credenciais do cofre do tenant.
// ---------------------------------------------------------------------------
exports.removeBoletoCredentials = onCall(async (request) => {
  const tenantId = requireMaster(request);

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
  // Emitir boleto exige a permissão específica "boletos" quando for um
  // membro — o mestre sempre pode.
  const tenantId = requireTenantAccess(request, 'boletos');
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

  // Garante que exista um token de webhook pra este tenant, mesmo que ele
  // tenha configurado o cofre antes dessa função existir.
  let webhookToken = vault.webhookToken;
  if (!webhookToken) {
    webhookToken = crypto.randomBytes(20).toString('hex');
    await getDb().collection('boletoVaults').doc(tenantId).set({ webhookToken }, { merge: true });
  }
  const webhookUrl = buildWebhookUrl(vault.provider, tenantId, webhookToken);

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
      webhookUrl,
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
    // Separado do "status" (que é o texto vindo do banco) — este campo é o
    // que o webhook realmente atualiza, e o que a tela usa pra decidir se
    // mostra "Pago" ou não. Ver seção "trate o aviso como boato".
    pago: false,
    paidAt: null,
    barcode: result.barcode || null,
    boletoUrl: result.boletoUrl || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await getDb().collection('tenants').doc(tenantId).collection('boletos').doc(result.boletoId).set(boletoRecord);

  return { ok: true, ...result };
});

// ---------------------------------------------------------------------------
// Webhook: aviso de pagamento — "trate como boato".
// ---------------------------------------------------------------------------
// Este endereço é PÚBLICO (o banco chama de fora, sem login nenhum) — então
// qualquer pessoa poderia, teoricamente, mandar um JSON dizendo "fulano
// pagou". Se acreditássemos nisso direto, um boleto poderia ser marcado como
// pago sem ter sido — problema fiscal e de confiança com o cliente, não só
// bug de tela.
//
// Por isso a regra é fixa: o aviso serve só de GATILHO. Ao recebê-lo, sempre
// perguntamos de novo pro banco (com a credencial real do próprio tenant) se
// aquilo é verdade, e só então atualizamos o nosso registro.
//
// Identificação do tenant: o próprio endereço do webhook carrega o UID
// (?u=...) e um token gerado só pra essa finalidade (?token=...) — nenhum dos
// dois é a proteção real (a reconsulta ao banco é), servem só pra filtrar
// ruído de robôs varrendo a internet.
function buildWebhookUrl(provider, tenantId, webhookToken) {
  const base = process.env.BOLETO_WEBHOOK_BASE_URL || 'https://us-central1-vitri-pro.cloudfunctions.net/boletoWebhook';
  return `${base}?provider=${encodeURIComponent(provider)}&u=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(webhookToken)}`;
}

// getBoletoWebhookUrl — o mestre usa isso pra ver/copiar o endereço de aviso
// e colar no painel do banco (Asaas e Inter exigem configurar isso à parte;
// a Efí não precisa, porque o endereço já vai embutido em cada cobrança).
exports.getBoletoWebhookUrl = onCall(async (request) => {
  const tenantId = requireMaster(request);

  const vaultSnap = await getDb().collection('boletoVaults').doc(tenantId).get();
  if (!vaultSnap.exists) {
    throw new HttpsError('failed-precondition', 'Configure o cofre de credenciais primeiro.');
  }
  const vault = vaultSnap.data();

  let webhookToken = vault.webhookToken;
  if (!webhookToken) {
    webhookToken = crypto.randomBytes(20).toString('hex');
    await getDb().collection('boletoVaults').doc(tenantId).set({ webhookToken }, { merge: true });
  }

  return { url: buildWebhookUrl(vault.provider, tenantId, webhookToken), provider: vault.provider };
});

// boletoWebhook — recebe o aviso dos 3 bancos. É uma função HTTP comum
// (onRequest), não uma Cloud Function autenticada (onCall) — o banco não faz
// login no Firebase, então não tem token de usuário nenhum aqui.
exports.boletoWebhook = onRequest({ secrets: [BOLETO_VAULT_KEY] }, async (req, res) => {
  // Responde rápido e sempre 200 — bancos reenviam o aviso se demorar ou se
  // não gostarem da resposta, e reenvio processado duas vezes é pior do que
  // eventualmente perder um aviso (a reconciliação manual cobre isso depois).
  try {
    const provider = String(req.query.provider || '').trim();
    const tenantId = String(req.query.u || '').trim();
    const receivedToken = String(req.query.token || '').trim();

    if (!provider || !tenantId) {
      res.status(200).send('ignorado: parâmetros ausentes');
      return;
    }

    const vaultSnap = await getDb().collection('boletoVaults').doc(tenantId).get();
    if (!vaultSnap.exists) {
      res.status(200).send('ignorado: tenant sem cofre configurado');
      return;
    }
    const vault = vaultSnap.data();

    // Filtro de ruído — não é a proteção real (essa vem da reconsulta abaixo).
    if (vault.webhookToken && receivedToken !== vault.webhookToken) {
      res.status(200).send('ignorado: token não confere');
      return;
    }
    if (vault.provider !== provider) {
      res.status(200).send('ignorado: provedor não confere com o cofre deste tenant');
      return;
    }

    const providerMod = getProvider(vault.provider);
    let decryptedSecrets;
    try {
      decryptedSecrets = JSON.parse(decrypt(vault.secretsEnc));
    } catch {
      res.status(200).send('ignorado: falha ao decifrar credenciais');
      return;
    }
    const credentials = {
      provider: vault.provider,
      ambiente: vault.ambiente,
      clientId: vault.clientId,
      ...decryptedSecrets,
    };

    // Cada banco manda o aviso num formato diferente — descobrimos quais
    // cobranças foram citadas, sem confiar no status que vier junto.
    let chargeIds = [];
    if (provider === 'efi') {
      // A Efí manda { notification: "<token>" } — o token é trocado pelo(s)
      // charge_id(s) de verdade numa segunda chamada, autenticada.
      const notificationToken = req.body && req.body.notification;
      if (notificationToken && providerMod.resolveNotification) {
        try {
          chargeIds = await providerMod.resolveNotification(credentials, notificationToken);
        } catch (err) {
          console.warn('[boletoWebhook][efi] Falha ao resolver notificação:', err.message);
        }
      }
    } else if (provider === 'asaas') {
      // A Asaas manda o objeto da cobrança dentro de "payment".
      const id = req.body && req.body.payment && req.body.payment.id;
      if (id) chargeIds = [String(id)];
    } else if (provider === 'inter') {
      // O Inter manda uma lista de cobranças afetadas.
      const lista = (req.body && (req.body.webhooks || req.body.cobrancas)) || [];
      chargeIds = lista.map((w) => String(w.codigoSolicitacao || w.seuNumero)).filter(Boolean);
    }

    if (chargeIds.length === 0) {
      res.status(200).send('ok: nenhuma cobrança identificada no aviso');
      return;
    }

    const boletosRef = getDb().collection('tenants').doc(tenantId).collection('boletos');

    for (const chargeId of chargeIds) {
      try {
        // A cobrança precisa EXISTIR no nosso sistema E pertencer a este
        // tenant — sem essa segunda conferência, um aviso com o id de uma
        // cobrança alheia daria baixa na conta errada.
        const boletoSnap = await boletosRef.doc(chargeId).get();
        if (!boletoSnap.exists) {
          console.warn(`[boletoWebhook][${provider}] Cobrança ${chargeId} não encontrada neste tenant — ignorado.`);
          continue;
        }
        if (boletoSnap.data().pago === true) {
          continue; // já processado antes — idempotência, evita duplicar
        }

        // Pergunta pro banco de novo — é este passo, não o aviso em si, que
        // decide se algo foi realmente pago.
        if (!providerMod.getBoletoStatus) continue;
        const statusReal = await providerMod.getBoletoStatus(credentials, chargeId);

        if (statusReal.pago) {
          await boletosRef.doc(chargeId).set(
            {
              pago: true,
              status: statusReal.status,
              paidAt: statusReal.paidAt || new Date().toISOString(),
            },
            { merge: true }
          );
          console.log(`[boletoWebhook][${provider}] Cobrança ${chargeId} confirmada como PAGA.`);
        }
      } catch (err) {
        console.warn(`[boletoWebhook][${provider}] Erro ao processar ${chargeId}:`, err.message);
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('[boletoWebhook] Erro inesperado:', err.message);
    // Mesmo em erro inesperado, responde 200 — não queremos que o banco
    // fique reenviando o mesmo aviso indefinidamente.
    res.status(200).send('erro registrado');
  }
});

// ---------------------------------------------------------------------------
// Assinatura do sistema (SaaS) — Mercado Pago
// ---------------------------------------------------------------------------
// Diferente do cofre de boletos (que é a vidraçaria cobrando OS CLIENTES DELA),
// isto aqui é o próprio sistema cobrando a mensalidade da vidraçaria pra usar
// o Vidraçaria Pro. R$49,90/mês, ou R$538,92 pagando os 12 meses de uma vez
// (10% de desconto). 7 dias de teste grátis, sem plano free depois disso.
const MP_ACCESS_TOKEN = defineSecret('MERCADO_PAGO_ACCESS_TOKEN');
const { calcularValidade, estenderValidade, resolverStatusAtual, PRECOS } = require('./billing');
const mp = require('./mercadopago');

function buildMPWebhookUrl() {
  return process.env.MP_WEBHOOK_BASE_URL || 'https://us-central1-vitri-pro.cloudfunctions.net/mercadoPagoWebhook';
}

// ---------------------------------------------------------------------------
// getSubscriptionStatus — a tela chama isso pra saber se libera o sistema.
// ---------------------------------------------------------------------------
// A verdade é sempre recalculada na leitura (nunca confia num campo "pronto"
// desatualizado) — se o plano expirou, atualiza o registro AQUI MESMO, sem
// precisar de nenhuma tarefa agendada rodando de madrugada.
exports.getSubscriptionStatus = onCall(async (request) => {
  const tenantId = requireTenantAccess(request);

  const billingRef = getDb().collection('tenants').doc(tenantId).collection('billing').doc('status');
  const snap = await billingRef.get();

  if (!snap.exists) {
    return { planType: 'expired', trialEndsAt: null, premiumUntil: null };
  }

  const billing = snap.data();
  const statusReal = resolverStatusAtual(billing);

  if (statusReal !== billing.planType) {
    await billingRef.set({ planType: statusReal, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  return {
    planType: statusReal,
    trialEndsAt: billing.trialEndsAt ? billing.trialEndsAt.toDate().toISOString() : null,
    premiumUntil: billing.premiumUntil ? billing.premiumUntil.toDate().toISOString() : null,
    billingCycle: billing.billingCycle || null,
    paymentMethod: billing.paymentMethod || null,
    subscriptionType: billing.subscriptionType || null,
  };
});

// ---------------------------------------------------------------------------
// createCheckout — inicia uma cobrança (Pix ou cartão, mensal ou anual).
// ---------------------------------------------------------------------------
exports.createCheckout = onCall({ secrets: [MP_ACCESS_TOKEN] }, async (request) => {
  const tenantId = requireMaster(request); // só o mestre paga a assinatura da conta
  const { billingCycle, paymentMethod, cardToken, payerEmail, idempotencyKey } = request.data || {};

  if (!['monthly', 'annual'].includes(billingCycle)) {
    throw new HttpsError('invalid-argument', 'Escolha o ciclo: mensal ou anual.');
  }
  if (!['pix', 'cartao'].includes(paymentMethod)) {
    throw new HttpsError('invalid-argument', 'Escolha a forma de pagamento: Pix ou cartão.');
  }
  if (!payerEmail) {
    throw new HttpsError('invalid-argument', 'Informe o e-mail do pagador.');
  }
  if (paymentMethod === 'cartao' && !cardToken) {
    throw new HttpsError('invalid-argument', 'Token do cartão ausente — o cartão precisa ser tokenizado no navegador antes de chegar aqui.');
  }
  if (!idempotencyKey) {
    throw new HttpsError('invalid-argument', 'Chave de idempotência ausente.');
  }

  const valor = PRECOS[billingCycle];
  const accessToken = MP_ACCESS_TOKEN.value();
  const notificationUrl = buildMPWebhookUrl();

  const billingRef = getDb().collection('tenants').doc(tenantId).collection('billing').doc('status');

  try {
    // Assinatura recorrente: só faz sentido pra cartão + mensal. Anual é
    // sempre pagamento único (mesmo no cartão) — "pagar de uma vez 12 meses".
    if (paymentMethod === 'cartao' && billingCycle === 'monthly') {
      const preapproval = await mp.criarAssinaturaRecorrente(accessToken, {
        valor, tenantId, payerEmail, cardToken, notificationUrl,
      });

      await billingRef.set(
        {
          mercadoPagoPreapprovalId: preapproval.id,
          mercadoPagoStatus: preapproval.status,
          billingCycle,
          paymentMethod,
          subscriptionType: 'recurring',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (preapproval.status === 'authorized') {
        const billingSnap = await billingRef.get();
        const novaValidade = estenderValidade(billingSnap.data()?.premiumUntil, billingCycle);
        await billingRef.set(
          { planType: 'premium', premiumUntil: novaValidade, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      return { ok: true, status: preapproval.status, type: 'recurring' };
    }

    const pagamento = await mp.criarPagamentoAvulso(accessToken, {
      valor,
      metodo: paymentMethod,
      tenantId,
      descricao: `Vidraçaria Pro — Assinatura ${billingCycle === 'annual' ? 'Anual' : 'Mensal'}`,
      payerEmail,
      cardToken,
      idempotencyKey,
      notificationUrl,
    });

    await billingRef.set(
      {
        mercadoPagoPaymentId: pagamento.id,
        mercadoPagoStatus: pagamento.status,
        billingCycle,
        paymentMethod,
        subscriptionType: 'single',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (pagamento.status === 'approved') {
      const billingSnap = await billingRef.get();
      const novaValidade = estenderValidade(billingSnap.data()?.premiumUntil, billingCycle);
      await billingRef.set(
        { planType: 'premium', premiumUntil: novaValidade, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    return {
      ok: true,
      status: pagamento.status,
      type: 'single',
      paymentId: pagamento.id,
      qrCode: pagamento.point_of_interaction?.transaction_data?.qr_code || null,
      qrCodeBase64: pagamento.point_of_interaction?.transaction_data?.qr_code_base64 || null,
    };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Falha ao criar cobrança no Mercado Pago.');
  }
});

// ---------------------------------------------------------------------------
// mercadoPagoWebhook — "o boato" do Mercado Pago. Nunca decide nada sozinho.
// ---------------------------------------------------------------------------
exports.mercadoPagoWebhook = onRequest({ secrets: [MP_ACCESS_TOKEN] }, async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const body = req.body || {};
    const accessToken = MP_ACCESS_TOKEN.value();

    const ehEventoDeAssinatura =
      body.type === 'subscription_preapproval' ||
      body.topic === 'subscription_preapproval' ||
      (body.action && body.action.startsWith('subscription_preapproval'));

    if (ehEventoDeAssinatura) {
      const preapprovalId = body.data?.id || body.id;
      if (!preapprovalId) return;

      const assinatura = await mp.consultarAssinatura(accessToken, preapprovalId);
      const tenantId = assinatura.external_reference;
      if (!tenantId) return;

      if (assinatura.status === 'cancelled' || assinatura.status === 'paused') {
        await getDb()
          .collection('tenants')
          .doc(tenantId)
          .collection('billing')
          .doc('status')
          .set(
            {
              mercadoPagoStatus: assinatura.status,
              subscriptionWillRenew: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
      return;
    }

    let paymentId = '';
    if (body.type === 'payment' && body.data?.id) paymentId = String(body.data.id);
    else if (body.action && body.action.startsWith('payment') && body.data?.id) paymentId = String(body.data.id);
    else if (body.topic === 'payment' && body.id) paymentId = String(body.id);
    else if (body.resource && body.topic === 'payment') {
      const m = String(body.resource).match(/\/payments\/(\d+)/);
      if (m) paymentId = m[1];
    }
    if (!paymentId) return;

    const pagamento = await mp.consultarPagamento(accessToken, paymentId);
    const tenantId = pagamento.external_reference;
    if (!tenantId) return;

    const billingRef = getDb().collection('tenants').doc(tenantId).collection('billing').doc('status');
    const billingSnap = await billingRef.get();
    const billingAtual = billingSnap.exists ? billingSnap.data() : {};

    await billingRef.set(
      { mercadoPagoStatus: pagamento.status, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (pagamento.status === 'approved') {
      const ciclo = billingAtual.billingCycle || 'monthly';
      const novaValidade = estenderValidade(billingAtual.premiumUntil, ciclo);
      await billingRef.set(
        { planType: 'premium', premiumUntil: novaValidade, subscriptionWillRenew: true },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('[mercadoPagoWebhook] Erro ao processar:', err.message);
  }
});

// ---------------------------------------------------------------------------
// ensureTrialStarted — garante os 7 dias de teste grátis no primeiro login.
// ---------------------------------------------------------------------------
// Mesmo o início do teste grátis passa pelo servidor — não existe caminho
// nenhum onde o navegador escreve o próprio plano, nem o valor inicial. Se
// existisse, bastaria repetir a chamada pra "renovar" o teste grátis pra
// sempre.
const { calcularFimTeste } = require('./billing');

exports.ensureTrialStarted = onCall(async (request) => {
  const uid = requireAuth(request);
  // Só o mestre tem teste grátis próprio — o acesso de um membro depende do
  // plano da conta do mestre dele, não de um plano individual.
  const token = request.auth.token || {};
  if (token.role === 'member') {
    return { ok: true, skipped: true };
  }

  const billingRef = getDb().collection('tenants').doc(uid).collection('billing').doc('status');
  const snap = await billingRef.get();
  if (snap.exists) {
    return { ok: true, alreadyExists: true };
  }

  await billingRef.set({
    planType: 'trial',
    trialEndsAt: calcularFimTeste(),
    premiumUntil: null,
    billingCycle: null,
    paymentMethod: null,
    subscriptionType: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, alreadyExists: false };
});

// ---------------------------------------------------------------------------
// CNPJ obrigatório, validado na Receita e travado após o cadastro.
// ---------------------------------------------------------------------------
// Duas funções, propositalmente separadas:
//   1. checkCnpjAvailable — chamada ANTES de criar a conta (sem login ainda),
//      só valida e mostra a razão social pra pessoa confirmar. Não reserva
//      nada ainda — evita ficar com CNPJs "reservados" por gente que desistiu
//      no meio do cadastro.
//   2. registerCnpj — chamada LOGO DEPOIS da conta ser criada (já logada),
//      dentro de uma transação: confere de novo que o CNPJ está livre e já
//      grava o vínculo de uma vez, atômico. É essa segunda checagem que
//      realmente impede duas pessoas cadastrando o mesmo CNPJ ao mesmo tempo.
const { validarCnpjReal, limparCnpj } = require('./cnpj');

exports.checkCnpjAvailable = onCall(async (request) => {
  const { cnpj } = request.data || {};
  if (!cnpj) {
    throw new HttpsError('invalid-argument', 'Informe o CNPJ.');
  }

  const cnpjLimpo = limparCnpj(cnpj);

  let dadosReceita;
  try {
    dadosReceita = await validarCnpjReal(cnpjLimpo);
  } catch (err) {
    throw new HttpsError('invalid-argument', err.message);
  }

  const registroSnap = await getDb().collection('cnpjRegistry').doc(cnpjLimpo).get();
  if (registroSnap.exists) {
    throw new HttpsError('already-exists', 'Já existe uma conta cadastrada com este CNPJ.');
  }

  return { ok: true, ...dadosReceita };
});

exports.registerCnpj = onCall(async (request) => {
  const tenantId = requireAuth(request);
  const { cnpj } = request.data || {};
  if (!cnpj) {
    throw new HttpsError('invalid-argument', 'Informe o CNPJ.');
  }

  const cnpjLimpo = limparCnpj(cnpj);

  let dadosReceita;
  try {
    dadosReceita = await validarCnpjReal(cnpjLimpo);
  } catch (err) {
    throw new HttpsError('invalid-argument', err.message);
  }

  const registroRef = getDb().collection('cnpjRegistry').doc(cnpjLimpo);
  const settingsRef = getDb().collection('tenants').doc(tenantId).collection('settings').doc(tenantId);

  // Transação: confere e grava atomicamente. Se duas pessoas tentarem
  // cadastrar o mesmo CNPJ ao mesmo tempo, só a primeira consegue — a
  // segunda recebe o erro "already-exists" aqui, não um estado quebrado.
  try {
    await getDb().runTransaction(async (tx) => {
      const registroSnap = await tx.get(registroRef);
      if (registroSnap.exists) {
        const donoAtual = registroSnap.data().tenantId;
        if (donoAtual !== tenantId) {
          throw new HttpsError('already-exists', 'Já existe uma conta cadastrada com este CNPJ.');
        }
        return; // já é o dono, nada a fazer (chamada repetida, idempotente)
      }

      tx.set(registroRef, {
        cnpj: cnpjLimpo,
        tenantId,
        razaoSocial: dadosReceita.razaoSocial,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(
        settingsRef,
        {
          cnpj: cnpjLimpo,
          cnpjRazaoSocial: dadosReceita.razaoSocial,
          cnpjValidadoEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message || 'Erro ao registrar o CNPJ.');
  }

  return { ok: true, razaoSocial: dadosReceita.razaoSocial };
});
