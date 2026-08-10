// Provedor Efí (ex-Gerencianet) — AINDA NÃO IMPLEMENTADO.
//
// Quando for integrar de verdade, a Efí usa OAuth2 client_credentials + certificado
// mTLS (.p12) para autenticar, e depois chama o endpoint de cobranças/boletos da
// API de Cobranças v2. Documentação: https://dev.efipay.com.br/
//
// Passos para implementar:
// 1. `npm install axios` (ou usar fetch nativo do Node 20) dentro de /functions
// 2. Guardar o certificado .p12 como Secret do Cloud Functions (não em Firestore)
// 3. Trocar client_id/client_secret + certificado por um access_token via
//    POST https://cobrancas.api.efipay.com.br/v1/authorize (produção)
// 4. Criar a cobrança via POST /v1/charge (ou /v2/charge para boleto direto)
// 5. Mapear o retorno da Efí para o mesmo formato usado pelo simulado.js:
//    { ok, boletoId, barcode, boletoUrl, status, amount, dueDate, payerName }
async function issueBoleto(_credentials, _boletoData) {
  throw new Error(
    'Integração com a Efí ainda não foi implementada. Veja functions/providers/efi.js para o roteiro de implementação.'
  );
}

module.exports = { issueBoleto };
