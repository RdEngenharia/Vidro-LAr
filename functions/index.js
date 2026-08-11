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
  return { orcamentos: false, clientes: false, precos: false, boletos: false };
}

function sanitizePermissions(input) {
  const p = input || {};
  return {
    orcamentos: !!p.orcamentos,
    clientes: !!p.clientes,
    precos: !!p.precos,
    boletos: !!p.boletos,
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
