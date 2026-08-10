// ---------------------------------------------------------------------------
// Provedor Banco Inter — implementação real.
// ---------------------------------------------------------------------------
// Documentação oficial: https://developers.inter.co/references/cobranca-bolepix
//
// Diferente da Efí e da Asaas, o Inter exige certificado digital mTLS em
// TODA chamada (inclusive na autenticação) — o certificado é apresentado no
// próprio handshake TLS da conexão, não só como um header. Por isso o Inter
// é o único provedor daqui que realmente precisa do upload de certificado
// (.pfx/.p12) no cofre.
//
// Fluxo:
//   1. POST /oauth/v2/token (mTLS + client_id/client_secret) → access_token
//   2. POST /cobranca/v3/cobrancas (mTLS + Bearer token) → cria a cobrança,
//      devolve um "codigoSolicitacao"
//   3. GET /cobranca/v3/cobrancas/{codigoSolicitacao} (mTLS + Bearer token)
//      → traz os dados finais do boleto (linha digitável, código de barras)
const https = require('https');

function interRequest(baseUrl, path, method, pfx, passphrase, headers, body, isFormEncoded) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const data = body
      ? isFormEncoded
        ? new URLSearchParams(body).toString()
        : JSON.stringify(body)
      : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      // Certificado digital apresentado no próprio handshake TLS — é isso
      // que faz a autenticação mTLS do Inter funcionar.
      pfx,
      passphrase: passphrase || undefined,
      headers: {
        'Content-Type': isFormEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
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
          const msg = parsed?.detail || parsed?.title || parsed?.mensagem || parsed?.raw || `HTTP ${res.statusCode}`;
          reject(new Error(`Banco Inter: ${msg}`));
        }
      });
    });

    req.on('error', (err) => {
      // Erro mais comum aqui: certificado inválido, senha errada, ou
      // certificado do ambiente errado (produção vs homologação).
      reject(new Error(`Falha de conexão/certificado com o Banco Inter: ${err.message}`));
    });
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken(baseUrl, pfx, passphrase, clientId, clientSecret) {
  const result = await interRequest(
    baseUrl,
    '/oauth/v2/token',
    'POST',
    pfx,
    passphrase,
    {},
    {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'boleto-cobranca.write boleto-cobranca.read',
    },
    true
  );
  if (!result.access_token) {
    throw new Error('O Banco Inter não retornou um token de acesso válido. Confira Client ID, Client Secret e o certificado.');
  }
  return result.access_token;
}

// Separa DDD e número de um telefone (o Inter pede os dois campos separados)
function splitPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return { ddd: '', telefone: '' };
  return { ddd: digits.slice(0, 2), telefone: digits.slice(2) };
}

async function issueBoleto(credentials, boletoData) {
  const { clientId, clientSecret, certificateBase64, certificatePassword, ambiente } = credentials;
  if (!clientId || !clientSecret || !certificateBase64) {
    throw new Error('Client ID, Client Secret e certificado do Banco Inter não configurados no cofre.');
  }

  const baseUrl =
    ambiente === 'homologacao'
      ? 'https://cdpj-sandbox.partners.uatinter.co'
      : 'https://cdpj.partners.bancointer.com.br';

  const { amount, dueDate, payerName, payerDocument, payerAddress, payerEmail, payerPhone, description } = boletoData;

  if (!payerDocument) {
    throw new Error('CPF/CNPJ do cliente é obrigatório para emitir boleto pelo Banco Inter.');
  }

  const pfx = Buffer.from(certificateBase64, 'base64');
  const token = await getAccessToken(baseUrl, pfx, certificatePassword, clientId, clientSecret);

  const cleanDocument = payerDocument.replace(/\D/g, '');
  const tipoPessoa = cleanDocument.length > 11 ? 'JURIDICA' : 'FISICA';
  const { ddd, telefone } = splitPhone(payerPhone);
  const addr = payerAddress || {};

  const chargePayload = {
    seuNumero: `VP${Date.now()}`.slice(0, 15),
    valorNominal: Number(amount.toFixed(2)),
    dataVencimento: dueDate,
    numDiasAgenda: 60,
    pagador: {
      cpfCnpj: cleanDocument,
      tipoPessoa,
      nome: payerName,
      email: payerEmail || undefined,
      ddd: ddd || undefined,
      telefone: telefone || undefined,
      endereco: addr.logradouro || 'Não informado',
      numero: addr.numero || 'S/N',
      bairro: addr.bairro || 'Não informado',
      cidade: addr.cidade || 'Não informado',
      uf: (addr.uf || 'BA').toUpperCase(),
      cep: (addr.cep || '').replace(/\D/g, '') || '00000000',
    },
    mensagem: description ? { linha1: description.slice(0, 70) } : undefined,
  };

  const created = await interRequest(
    baseUrl,
    '/cobranca/v3/cobrancas',
    'POST',
    pfx,
    certificatePassword,
    { Authorization: `Bearer ${token}` },
    chargePayload
  );

  const codigoSolicitacao = created.codigoSolicitacao || created.seuNumero;
  if (!codigoSolicitacao) {
    throw new Error('O Banco Inter criou a cobrança, mas não retornou um identificador (codigoSolicitacao) — verifique o log da function para o retorno completo.');
  }

  // Busca os dados finais (linha digitável, código de barras) — a criação
  // costuma devolver só o identificador da cobrança.
  let details = {};
  try {
    details = await interRequest(
      baseUrl,
      `/cobranca/v3/cobrancas/${codigoSolicitacao}`,
      'GET',
      pfx,
      certificatePassword,
      { Authorization: `Bearer ${token}` }
    );
  } catch {
    // Se a consulta de detalhes falhar, ainda devolvemos o que temos da
    // criação — o boleto foi criado no banco de qualquer forma.
  }

  const boleto = details.boleto || details.cobranca?.boleto || {};

  return {
    ok: true,
    simulated: false,
    boletoId: String(codigoSolicitacao),
    barcode: boleto.codigoBarras || boleto.linhaDigitavel || null,
    boletoUrl: boleto.linkPdf || boleto.pdf || null,
    status: (details.cobranca && details.cobranca.situacao) || details.situacao || 'EM_PROCESSAMENTO',
    amount,
    dueDate,
    payerName,
  };
}

module.exports = {
  issueBoleto,
  implemented: true,
  label: 'Banco Inter',
  // O Inter entrega .crt + .key separados — a API de cobrança exige um
  // .pfx/.p12 único, então geralmente é preciso converter antes de subir aqui.
  credentialFields: [
    { id: 'clientId', label: 'Client ID', type: 'text' },
    { id: 'clientSecret', label: 'Client Secret', type: 'password' },
    {
      id: 'certificateBase64',
      label: 'Certificado convertido (.pfx/.p12)',
      type: 'file',
      accept: '.pfx,.p12',
      hint: 'O Inter entrega .crt + .key separados — converta para .pfx/.p12 antes de enviar aqui.',
    },
    { id: 'certificatePassword', label: 'Senha do certificado (se houver)', type: 'password', optional: true },
  ],
};
