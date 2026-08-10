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

module.exports = { issueBoleto };
