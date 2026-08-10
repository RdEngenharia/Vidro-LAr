// ---------------------------------------------------------------------------
// Cloud Functions do Sistema Vidraçaria Pro
// ---------------------------------------------------------------------------
// Por que isso precisa existir num servidor, e não só no navegador:
// Credenciais de banco (Client ID / Client Secret) NUNCA podem chegar ao
// navegador do usuário — qualquer pessoa com o DevTools aberto conseguiria
// roubá-las. Essas duas funções guardam e usam essas credenciais só aqui, no
// servidor, e o app web só conversa com elas por chamadas autenticadas.
//
// Isolamento entre usuários (multi-tenant SaaS):
// Em toda função, o "dono dos dados" é sempre `request.auth.uid` — o UID da
// sessão de login validada pelo próprio Firebase. Nunca confiamos em um
// tenantId enviado pelo cliente; se alguém tentar adulterar a requisição pra
// tentar acessar o cofre de outro usuário, `request.auth.uid` continua sendo
// o dele mesmo, então ele só alcança os próprios dados.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getProvider } = require('./providers');

admin.initializeApp();
const db = admin.firestore();

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Você precisa estar logado para usar esta função.');
  }
  return request.auth.uid;
}

// ---------------------------------------------------------------------------
// saveBoletoCredentials — grava as credenciais do banco no cofre do tenant.
// ---------------------------------------------------------------------------
// O documento em `boletoVaults/{tenantId}` é bloqueado nas regras do Firestore
// (ninguém lê/escreve direto por lá, nem o próprio dono) — só esta função,
// rodando com privilégio de administrador, consegue tocar nele. O app web só
// sabe dizer "está configurado" ou não, nunca vê o segredo de volta.
exports.saveBoletoCredentials = onCall(async (request) => {
  const tenantId = requireAuth(request);
  const { provider, clientId, clientSecret, extra } = request.data || {};

  if (!provider || typeof provider !== 'string') {
    throw new HttpsError('invalid-argument', 'Informe qual provedor/banco está configurando.');
  }
  if (!clientId || !clientSecret) {
    throw new HttpsError('invalid-argument', 'Informe o Client ID e o Client Secret.');
  }

  await db.collection('boletoVaults').doc(tenantId).set(
    {
      provider,
      clientId,
      clientSecret,
      extra: extra || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: false } // troca tudo — evita misturar credenciais de provedores diferentes
  );

  // Status "público" (sem segredo nenhum) que o app web PODE ler, só pra saber
  // se já existe uma configuração e de qual provedor, para exibir na tela.
  await db
    .collection('tenants')
    .doc(tenantId)
    .collection('boletoConfig')
    .doc('status')
    .set({
      configured: true,
      provider,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// removeBoletoCredentials — apaga as credenciais do cofre do tenant.
// ---------------------------------------------------------------------------
exports.removeBoletoCredentials = onCall(async (request) => {
  const tenantId = requireAuth(request);

  await db.collection('boletoVaults').doc(tenantId).delete();
  await db
    .collection('tenants')
    .doc(tenantId)
    .collection('boletoConfig')
    .doc('status')
    .set({ configured: false, provider: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// issueBoleto — emite um boleto usando as credenciais guardadas no cofre.
// ---------------------------------------------------------------------------
exports.issueBoleto = onCall(async (request) => {
  const tenantId = requireAuth(request);
  const { customerId, customerName, quoteId, quoteCodeNumber, amount, dueDate, description } =
    request.data || {};

  if (!amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Informe um valor válido para o boleto.');
  }
  if (!dueDate) {
    throw new HttpsError('invalid-argument', 'Informe a data de vencimento do boleto.');
  }
  if (!customerName) {
    throw new HttpsError('invalid-argument', 'Informe o cliente para quem o boleto será emitido.');
  }

  const vaultSnap = await db.collection('boletoVaults').doc(tenantId).get();
  if (!vaultSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      'Nenhuma credencial de banco configurada ainda. Configure o Cofre de Boletos primeiro.'
    );
  }

  const credentials = vaultSnap.data();
  const provider = getProvider(credentials.provider);

  let result;
  try {
    result = await provider.issueBoleto(credentials, {
      amount,
      dueDate,
      payerName: customerName,
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
    provider: credentials.provider,
    simulated: !!result.simulated,
    status: result.status,
    barcode: result.barcode || null,
    boletoUrl: result.boletoUrl || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection('tenants')
    .doc(tenantId)
    .collection('boletos')
    .doc(result.boletoId)
    .set(boletoRecord);

  return { ok: true, ...result };
});
