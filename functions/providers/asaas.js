// ---------------------------------------------------------------------------
// Provedor Asaas — implementação real.
// ---------------------------------------------------------------------------
// Documentação oficial: https://docs.asaas.com/
// Autenticação: Chave de API simples no header "access_token" (sem OAuth2,
// sem certificado mTLS — é por isso que a Asaas é o provedor mais simples
// dos três disponíveis aqui).
//
// Fluxo (conforme documentação oficial):
//   1. Busca ou cria o cliente (POST /v3/customers) — a Asaas exige um
//      "customer" vinculado à cobrança.
//   2. Cria a cobrança em boleto (POST /v3/payments, billingType: "BOLETO").
//   3. A resposta já vem com o link do PDF do boleto (bankSlipUrl) e a linha
//      digitável (identificationField) prontos para uso.
const https = require('https');

function asaasRequest(baseUrl, path, method, apiKey, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        // A Asaas autentica pela própria chave de API neste header — não é
        // um "Bearer token" OAuth2 como outros bancos.
        access_token: apiKey,
        'User-Agent': 'VidracariaPro/1.0',
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
          const msg =
            (parsed.errors && parsed.errors.map((e) => e.description).join('; ')) ||
            parsed.raw ||
            `A Asaas respondeu com erro HTTP ${res.statusCode}`;
          reject(new Error(msg));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Falha de conexão com a Asaas: ${err.message}`)));
    if (data) req.write(data);
    req.end();
  });
}

async function issueBoleto(credentials, boletoData) {
  const { apiKey, ambiente } = credentials;
  if (!apiKey) {
    throw new Error('Chave de API do Asaas não configurada no cofre.');
  }

  const baseUrl = ambiente === 'homologacao' ? 'https://api-sandbox.asaas.com' : 'https://api.asaas.com';
  const { amount, dueDate, payerName, payerDocument, description } = boletoData;

  if (!payerDocument) {
    throw new Error('CPF/CNPJ do cliente é obrigatório para criar cobranças no Asaas.');
  }

  // 1. Busca um cliente já cadastrado com esse CPF/CNPJ (evita duplicar
  // clientes no Asaas a cada boleto emitido para a mesma pessoa).
  let customerId;
  const search = await asaasRequest(
    baseUrl,
    `/v3/customers?cpfCnpj=${encodeURIComponent(payerDocument)}`,
    'GET',
    apiKey
  );

  if (search && Array.isArray(search.data) && search.data.length > 0) {
    customerId = search.data[0].id;
  } else {
    const customer = await asaasRequest(baseUrl, '/v3/customers', 'POST', apiKey, {
      name: payerName,
      cpfCnpj: payerDocument,
    });
    customerId = customer.id;
  }

  // 2. Cria a cobrança em boleto vinculada a esse cliente.
  const payment = await asaasRequest(baseUrl, '/v3/payments', 'POST', apiKey, {
    customer: customerId,
    billingType: 'BOLETO',
    value: amount,
    dueDate,
    description: description || undefined,
  });

  return {
    ok: true,
    simulated: false,
    boletoId: payment.id,
    barcode: payment.identificationField || null,
    boletoUrl: payment.bankSlipUrl || payment.invoiceUrl || null,
    status: payment.status || 'PENDING',
    amount,
    dueDate,
    payerName,
  };
}

module.exports = {
  issueBoleto,
  implemented: true,
  label: 'Asaas',
  // O Asaas é mais simples que os bancos com certificado: só uma Chave de
  // API (enviada no header access_token). Sem Client ID/Secret, sem certificado.
  credentialFields: [{ id: 'apiKey', label: 'Chave de API (API Key)', type: 'password' }],
};
