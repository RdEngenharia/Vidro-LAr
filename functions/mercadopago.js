// ---------------------------------------------------------------------------
// Cliente HTTP para a API do Mercado Pago.
// ---------------------------------------------------------------------------
// Mesmo padrão dos provedores de boleto (asaas.js, efi.js, inter.js): sem SDK
// externo, só o módulo https nativo do Node, pra manter as dependências do
// projeto mínimas e auditáveis.
const https = require('https');

function mpRequest(path, method, accessToken, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.mercadopago.com' + path);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(extraHeaders || {}),
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const msg = parsed?.message || parsed?.error || parsed?.raw || `HTTP ${res.statusCode}`;
          reject(new Error(`Mercado Pago: ${msg}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Falha de conexão com o Mercado Pago: ${err.message}`)));
    if (data) req.write(data);
    req.end();
  });
}

// Limpa o token — colar com aspas no painel da hospedagem é engano frequente
// e o erro que aparece (401 unauthorized) manda procurar o problema no
// lugar errado.
function limparToken(token) {
  return (token || '').replace(/^["']|["']$/g, '').trim();
}

// Cria uma cobrança avulsa (Pix ou cartão de crédito único — não recorrente).
async function criarPagamentoAvulso(accessToken, { valor, metodo, tenantId, descricao, payerEmail, cardToken, idempotencyKey, notificationUrl }) {
  const payload = {
    transaction_amount: valor,
    description: descricao,
    external_reference: tenantId, // a espinha dorsal: liga o pagamento à conta certa
    notification_url: notificationUrl,
    payer: { email: payerEmail },
  };

  if (metodo === 'pix') {
    payload.payment_method_id = 'pix';
  } else {
    payload.token = cardToken; // token gerado NO NAVEGADOR — nunca o cartão em si
    payload.installments = 1;
    payload.payment_method_id = 'master'; // MP identifica a bandeira pelo token; alguns fluxos exigem um valor aqui, ajustado se necessário
  }

  return mpRequest('/v1/payments', 'POST', limparToken(accessToken), payload, {
    // Chave de idempotência ESTÁVEL pra mesma tentativa de compra — nunca com
    // Date.now() dentro, senão a proteção contra clique duplo fica desligada
    // (cada tentativa geraria uma chave nova, e o MP trataria como cobranças
    // diferentes).
    'X-Idempotency-Key': idempotencyKey,
  });
}

// Cria uma assinatura recorrente (só cartão) — quem cobra todo mês é o
// próprio Mercado Pago, sozinho, sem o sistema fazer nada.
async function criarAssinaturaRecorrente(accessToken, { valor, tenantId, payerEmail, cardToken, notificationUrl }) {
  const payload = {
    reason: 'Assinatura Vidraçaria Pro',
    external_reference: tenantId,
    payer_email: payerEmail,
    card_token_id: cardToken,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: valor,
      currency_id: 'BRL',
    },
    back_url: 'https://vidrolar.rdhomologacao.com.br',
    notification_url: notificationUrl,
    status: 'authorized',
  };
  return mpRequest('/preapproval', 'POST', limparToken(accessToken), payload);
}

async function consultarPagamento(accessToken, paymentId) {
  return mpRequest(`/v1/payments/${paymentId}`, 'GET', limparToken(accessToken));
}

async function consultarAssinatura(accessToken, preapprovalId) {
  return mpRequest(`/preapproval/${preapprovalId}`, 'GET', limparToken(accessToken));
}

module.exports = {
  criarPagamentoAvulso,
  criarAssinaturaRecorrente,
  consultarPagamento,
  consultarAssinatura,
  limparToken,
};
