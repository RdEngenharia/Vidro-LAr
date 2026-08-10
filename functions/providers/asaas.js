// Provedor Asaas — AINDA NÃO IMPLEMENTADO.
//
// O Asaas é o mais simples de integrar entre as opções: autenticação por API Key
// simples (sem certificado mTLS), enviada no header "access_token". Documentação:
// https://docs.asaas.com/
//
// Passos para implementar:
// 1. Criar o cliente (payer) via POST https://api.asaas.com/v3/customers
//    (ou reaproveitar um customer Asaas já existente, guardando o ID retornado)
// 2. Criar a cobrança via POST https://api.asaas.com/v3/payments
//    com billingType: "BOLETO"
// 3. O retorno já vem com bankSlipUrl (link do boleto) e identificationField
//    (linha digitável) prontos — é o provedor com menos trabalho de mapeamento.
// 4. Mapear para o mesmo formato usado pelo simulado.js:
//    { ok, boletoId, barcode, boletoUrl, status, amount, dueDate, payerName }
//
// Observação: se ainda não decidiu o gateway, Asaas costuma ser o ponto de
// partida mais rápido justamente por não exigir certificado digital.
async function issueBoleto(_credentials, _boletoData) {
  throw new Error(
    'Integração com o Asaas ainda não foi implementada. Veja functions/providers/asaas.js para o roteiro de implementação.'
  );
}

module.exports = { issueBoleto, implemented: false, label: 'Asaas' };
