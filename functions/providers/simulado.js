// Provedor "simulado" — usado enquanto nenhum banco/gateway real foi configurado.
// Gera um resultado de exemplo, claramente identificado como TESTE, para que o
// restante do sistema (tela de emissão, download, histórico) possa ser
// construído e testado de ponta a ponta antes de qualquer banco real existir.
//
// Quando o usuário decidir o gateway (Efí, Inter, Asaas, etc.), basta criar um
// arquivo novo aqui em /providers seguindo esta mesma assinatura de função e
// registrá-lo em providers/index.js — nenhum outro lugar do sistema precisa
// mudar, porque o restante do código enxerga apenas essa interface (não sabe
// nem se importa qual banco está por trás).
async function issueBoleto(_credentials, boletoData) {
  const { amount, dueDate, payerName } = boletoData;

  const fakeBarcode = '00190.00009 03456.789012 34567.890123 4 ' + Date.now().toString().slice(-14);

  return {
    ok: true,
    simulated: true,
    boletoId: `SIMULADO_${Date.now()}`,
    barcode: fakeBarcode,
    // Um PDF de exemplo simples poderia ser gerado aqui; por enquanto retornamos
    // apenas os dados estruturados para a tela mostrar um preview claro de TESTE.
    boletoUrl: null,
    status: 'simulado',
    amount,
    dueDate,
    payerName,
    message: 'Este é um boleto de TESTE (nenhum banco real configurado ainda). Nenhuma cobrança real foi gerada.',
  };
}

module.exports = { issueBoleto };
