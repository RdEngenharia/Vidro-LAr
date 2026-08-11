// ---------------------------------------------------------------------------
// Provedor Efí (ex-Gerencianet) — implementação real.
// ---------------------------------------------------------------------------
// Documentação oficial: https://dev.efipay.com.br/docs/api-cobrancas/
//
// A API de Cobranças da Efí (Boleto/Carnê/Cartão) é uma exceção dentro do
// ecossistema deles: usa só OAuth2 client_credentials via HTTP Basic Auth
// (Client ID + Client Secret), SEM certificado mTLS — diferente do Pix.
//
// Fluxo:
//   1. POST /v1/authorize (Basic Auth) → access_token
//   2. POST /v1/charge/one-step (Bearer token) → cria a cobrança E já associa
//      o boleto como forma de pagamento numa chamada só.
//   3. A resposta traz o código de barras, o link do PDF e o status.
//
// IMPORTANTE: a Efí trabalha com valores em CENTAVOS (ex: 8900 = R$ 89,00),
// diferente do resto do nosso sistema, que usa reais — a conversão acontece
// só aqui dentro, isolada.
const https = require('https');

function efiRequest(baseUrl, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
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
          const msg = parsed?.error_description || parsed?.mensagem || parsed?.raw || `HTTP ${res.statusCode}`;
          reject(new Error(`Efí: ${msg}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Falha de conexão com a Efí: ${err.message}`)));
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken(baseUrl, clientId, clientSecret) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const result = await efiRequest(baseUrl, '/v1/authorize', 'POST', { Authorization: `Basic ${basicAuth}` }, {
    grant_type: 'client_credentials',
  });
  if (!result.access_token) {
    throw new Error('A Efí não retornou um token de acesso válido. Confira o Client ID e o Client Secret.');
  }
  return result.access_token;
}

// Converte o endereço do nosso formato para o esperado pela Efí
function mapAddress(address) {
  if (!address) return undefined;
  return {
    street: address.logradouro || '',
    number: address.numero || 'S/N',
    neighborhood: address.bairro || '',
    zipcode: (address.cep || '').replace(/\D/g, ''),
    city: address.cidade || '',
    state: (address.uf || '').toUpperCase(),
  };
}

async function issueBoleto(credentials, boletoData) {
  const { clientId, clientSecret, ambiente } = credentials;
  if (!clientId || !clientSecret) {
    throw new Error('Client ID e Client Secret da Efí não configurados no cofre.');
  }

  const baseUrl =
    ambiente === 'homologacao' ? 'https://cobrancas-h.api.efipay.com.br' : 'https://cobrancas.api.efipay.com.br';

  const { amount, dueDate, payerName, payerDocument, payerAddress, description, webhookUrl } = boletoData;

  if (!payerDocument) {
    throw new Error('CPF/CNPJ do cliente é obrigatório para emitir boleto pela Efí.');
  }

  const token = await getAccessToken(baseUrl, clientId, clientSecret);

  const cleanDocument = payerDocument.replace(/\D/g, '');
  const isCnpj = cleanDocument.length > 11;
  const amountInCents = Math.round(amount * 100);

  const chargePayload = {
    items: [{ name: description || 'Serviços de vidraçaria', value: amountInCents, amount: 1 }],
    payment: {
      banking_billet: {
        expire_at: dueDate,
        customer: {
          name: payerName,
          [isCnpj ? 'cnpj' : 'cpf']: cleanDocument,
          ...(payerAddress ? { address: mapAddress(payerAddress) } : {}),
        },
      },
    },
    // O endereço de aviso de pagamento vai AQUI, em cada cobrança — não na aba
    // "URL de callback" do painel da Efí (aquela é o formato antigo, em XML).
    // Configurado por cobrança, a Efí manda um token de notificação pra essa
    // URL quando o status muda; nós então consultamos de volta pra confirmar
    // (nunca confiamos direto no que a chamada do webhook diz).
    ...(webhookUrl ? { metadata: { notification_url: webhookUrl } } : {}),
  };

  const result = await efiRequest(baseUrl, '/v1/charge/one-step', 'POST', { Authorization: `Bearer ${token}` }, chargePayload);

  const data = result.data || result;

  return {
    ok: true,
    simulated: false,
    boletoId: String(data.charge_id),
    barcode: data.barcode || null,
    boletoUrl: (data.pdf && data.pdf.charge) || data.billet_link || data.link || null,
    status: data.status || 'waiting',
    amount,
    dueDate,
    payerName,
  };
}

// ---------------------------------------------------------------------------
// resolveNotification — troca o token que a Efí manda no aviso pelo(s)
// identificador(es) de cobrança realmente afetados.
// ---------------------------------------------------------------------------
async function resolveNotification(credentials, notificationToken) {
  const { clientId, clientSecret, ambiente } = credentials;
  const baseUrl =
    ambiente === 'homologacao' ? 'https://cobrancas-h.api.efipay.com.br' : 'https://cobrancas.api.efipay.com.br';
  const token = await getAccessToken(baseUrl, clientId, clientSecret);

  const result = await efiRequest(
    baseUrl,
    `/v1/notification/${notificationToken}`,
    'GET',
    { Authorization: `Bearer ${token}` }
  );
  const list = (result.data && result.data) || [];
  return (Array.isArray(list) ? list : [list]).map((item) => String(item.identifiers?.charge_id || item.charge_id));
}

// ---------------------------------------------------------------------------
// getBoletoStatus — consulta o status REAL de uma cobrança direto na Efí.
// ---------------------------------------------------------------------------
// Mesma ideia da Asaas: o aviso é só um gatilho, nunca uma confirmação. Antes
// de marcar qualquer coisa como paga, perguntamos de novo pra Efí.
async function getBoletoStatus(credentials, chargeId) {
  const { clientId, clientSecret, ambiente } = credentials;
  const baseUrl =
    ambiente === 'homologacao' ? 'https://cobrancas-h.api.efipay.com.br' : 'https://cobrancas.api.efipay.com.br';
  const token = await getAccessToken(baseUrl, clientId, clientSecret);

  const result = await efiRequest(baseUrl, `/v1/charge/${chargeId}`, 'GET', { Authorization: `Bearer ${token}` });
  const data = result.data || result;

  const PAGOS = ['paid', 'settled'];
  return {
    boletoId: String(chargeId),
    status: data.status,
    pago: PAGOS.includes(data.status),
    paidAt: data.paid_at || null,
  };
}

module.exports = {
  issueBoleto,
  resolveNotification,
  getBoletoStatus,
  implemented: true,
  label: 'Efí (Gerencianet)',
  // A API de Cobranças da Efí (Boleto/Carnê/Cartão) é uma exceção dentro do
  // ecossistema deles: diferente do Pix, ela usa só OAuth2 client_credentials
  // (Client ID + Client Secret via Basic Auth), SEM certificado mTLS.
  // Confirmado na documentação oficial: https://github.com/efipay/sdk-php-apis-efi
  // ("Com exceção da API Cobranças... é obrigatório informar certificado").
  credentialFields: [
    { id: 'clientId', label: 'Client ID', type: 'text' },
    { id: 'clientSecret', label: 'Client Secret', type: 'password' },
  ],
};
