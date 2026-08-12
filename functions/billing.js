// ---------------------------------------------------------------------------
// Cálculo de validade do plano — função única, chamada de todo lugar que
// precisa saber "até quando vale o acesso".
// ---------------------------------------------------------------------------
// Pista de bug clássica (documentada e já vivida em produção): duas funções
// diferentes gravando o mesmo campo com regras diferentes. Uma delas acaba
// sobrescrevendo a outra num caminho que ninguém testou. A correção não é
// ajustar o número — é o cálculo existir NUM LUGAR SÓ, recebendo o ciclo como
// parâmetro, e todo o resto do sistema chama essa função, nunca calcula na mão.
const admin = require('firebase-admin');

const DIAS_POR_CICLO = { monthly: 30, annual: 365 };

// Calcula uma validade nova, a partir de agora.
function calcularValidade(ciclo) {
  const dias = DIAS_POR_CICLO[ciclo] || 30;
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return admin.firestore.Timestamp.fromDate(d);
}

// Estende uma validade existente — usado quando uma assinatura recorrente
// cobra de novo. "Renovação estende, não substitui": se a pessoa ainda tem
// alguns dias de acesso e a cobrança do mês passa, a validade nova soma a
// partir do que já restava, não a partir de "agora" (senão um atraso de duas
// horas no processamento do Mercado Pago derrubaria o acesso de quem paga em dia).
function estenderValidade(validadeAtual, ciclo) {
  const agora = new Date();
  const baseData = validadeAtual && validadeAtual.toDate() > agora ? validadeAtual.toDate() : agora;
  const dias = DIAS_POR_CICLO[ciclo] || 30;
  const nova = new Date(baseData);
  nova.setDate(nova.getDate() + dias);
  return admin.firestore.Timestamp.fromDate(nova);
}

function calcularFimTeste() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return admin.firestore.Timestamp.fromDate(d);
}

// A verdade sobre o plano, sempre calculada na hora de ler — nunca guardada
// "pronta" nem dependente de uma tarefa noturna rodando. Se ninguém consultou
// esse tenant, um valor desatualizado não fez mal a ninguém.
function resolverStatusAtual(billing) {
  const agora = new Date();

  if (billing.planType === 'premium' && billing.premiumUntil && billing.premiumUntil.toDate() > agora) {
    return 'premium';
  }
  if (billing.planType === 'trial' && billing.trialEndsAt && billing.trialEndsAt.toDate() > agora) {
    return 'trial';
  }
  return 'expired';
}

// Valores em reais — R$49,90/mês, com 10% de desconto pagando os 12 meses de
// uma vez (R$538,92 em vez de R$598,80).
const PRECOS = {
  monthly: 49.9,
  annual: 538.92,
};

module.exports = { calcularValidade, estenderValidade, calcularFimTeste, resolverStatusAtual, PRECOS, DIAS_POR_CICLO };
