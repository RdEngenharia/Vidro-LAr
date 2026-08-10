// Provedor Banco Inter — AINDA NÃO IMPLEMENTADO.
//
// O Inter também usa OAuth2 client_credentials + certificado mTLS (.crt/.key)
// gerado no Internet Banking > API > Aplicações. Documentação:
// https://developers.bancointer.com.br/
//
// Passos para implementar:
// 1. Guardar o certificado (.crt/.key) como Secret do Cloud Functions
// 2. Obter access_token via POST https://cdpj.partners.bancointer.com.br/oauth/v2/token
//    com scope "boleto-cobranca.write boleto-cobranca.read"
// 3. Criar a cobrança via POST /cobranca/v3/cobrancas
// 4. Mapear o retorno para o mesmo formato usado pelo simulado.js:
//    { ok, boletoId, barcode, boletoUrl, status, amount, dueDate, payerName }
async function issueBoleto(_credentials, _boletoData) {
  throw new Error(
    'Integração com o Banco Inter ainda não foi implementada. Veja functions/providers/inter.js para o roteiro de implementação.'
  );
}

module.exports = {
  issueBoleto,
  implemented: false,
  label: 'Banco Inter',
  // O Inter usa OAuth2 client_credentials + certificado mTLS. O banco entrega
  // um .crt + .key separados — a API de boletos costuma exigir um .pfx/.p12
  // único, então geralmente é preciso converter antes de subir aqui.
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
