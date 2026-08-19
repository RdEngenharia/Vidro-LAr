// ---------------------------------------------------------------------------
// Motor de cálculo do Estoque — puro, sem React nem Firestore.
// ---------------------------------------------------------------------------
// Toda conta que envolve dinheiro (custo médio ponderado, valor em estoque,
// quanto uma baixa custou) mora aqui, testada isoladamente. As telas nunca
// somam quantidade × custo direto no JSX — sempre chamam estas funções.
import { ItemEstoque, MovimentoEstoque, UnidadeEstoque } from '../types';
import { genId } from './id';

export function criarItemEstoque(params: {
  tenantId: string;
  nome: string;
  unidade: UnidadeEstoque;
  categoria?: string;
  estoqueMinimo?: number;
}): ItemEstoque {
  const now = new Date().toISOString();
  return {
    id: genId('estoque'),
    tenantId: params.tenantId,
    nome: params.nome.trim(),
    unidade: params.unidade,
    categoria: params.categoria?.trim() || undefined,
    estoqueMinimo: params.estoqueMinimo,
    quantidadeAtual: 0,
    custoMedio: 0,
    createdAt: now,
    atualizadoEm: now,
  };
}

// Registra uma compra (entrada). O custo médio ponderado é recalculado assim:
//   novoCustoMedio = (valorTotalJáEmEstoque + valorDestaCompra) / novaQuantidadeTotal
// O frete entra no custo — ele também é dinheiro gasto pra ter esse material
// disponível, então precisa aparecer no custo médio, não ficar de fora.
export function registrarEntrada(
  item: ItemEstoque,
  params: { quantidade: number; custoUnitario: number; frete?: number; data: string }
): { itemAtualizado: ItemEstoque; movimento: MovimentoEstoque } {
  const frete = params.frete || 0;
  const valorJaEmEstoque = item.quantidadeAtual * item.custoMedio;
  const valorDestaCompra = params.quantidade * params.custoUnitario + frete;
  const novaQuantidade = item.quantidadeAtual + params.quantidade;
  const novoCustoMedio = novaQuantidade > 0 ? (valorJaEmEstoque + valorDestaCompra) / novaQuantidade : 0;

  const movimento: MovimentoEstoque = {
    id: genId('mov'),
    tipo: 'entrada',
    quantidade: params.quantidade,
    data: params.data,
    createdAt: new Date().toISOString(),
    custoUnitario: params.custoUnitario,
    frete,
    estoqueAntesDoMovimento: { quantidadeAtual: item.quantidadeAtual, custoMedio: item.custoMedio },
  };

  const itemAtualizado: ItemEstoque = {
    ...item,
    quantidadeAtual: novaQuantidade,
    custoMedio: novoCustoMedio,
    atualizadoEm: new Date().toISOString(),
  };

  return { itemAtualizado, movimento };
}

// Registra uma baixa (consumo). O custo médio NÃO muda numa saída — só a
// quantidade diminui. O valor da baixa usa o custo médio de AGORA (no
// momento em que o material saiu), não um custo futuro nem um custo antigo.
export function registrarSaida(
  item: ItemEstoque,
  params: {
    quantidade: number;
    data: string;
    clienteId?: string;
    clienteNome?: string;
    quoteId?: string;
    quoteCodeNumber?: number;
  }
): { itemAtualizado: ItemEstoque; movimento: MovimentoEstoque } {
  const valorTotal = params.quantidade * item.custoMedio;

  const movimento: MovimentoEstoque = {
    id: genId('mov'),
    tipo: 'saida',
    quantidade: params.quantidade,
    data: params.data,
    createdAt: new Date().toISOString(),
    clienteId: params.clienteId,
    clienteNome: params.clienteNome,
    quoteId: params.quoteId,
    quoteCodeNumber: params.quoteCodeNumber,
    valorTotal,
    estoqueAntesDoMovimento: { quantidadeAtual: item.quantidadeAtual, custoMedio: item.custoMedio },
  };

  const itemAtualizado: ItemEstoque = {
    ...item,
    quantidadeAtual: item.quantidadeAtual - params.quantidade,
    atualizadoEm: new Date().toISOString(),
  };

  return { itemAtualizado, movimento };
}

// Desfazer = restaurar o snapshot gravado ANTES do movimento — nunca tenta
// reverter a matemática do custo médio na unha (arriscado com ponto
// flutuante, especialmente depois de várias compras em sequência).
export function desfazerMovimento(item: ItemEstoque, movimento: MovimentoEstoque): ItemEstoque {
  return {
    ...item,
    quantidadeAtual: movimento.estoqueAntesDoMovimento.quantidadeAtual,
    custoMedio: movimento.estoqueAntesDoMovimento.custoMedio,
    atualizadoEm: new Date().toISOString(),
  };
}

export function estoqueSuficiente(item: ItemEstoque, quantidade: number): boolean {
  return item.quantidadeAtual >= quantidade;
}

export function valorEmEstoque(item: ItemEstoque): number {
  return item.quantidadeAtual * item.custoMedio;
}

export function valorTotalEstoque(itens: ItemEstoque[]): number {
  return itens.reduce((soma, item) => soma + valorEmEstoque(item), 0);
}

export function itensComEstoqueBaixo(itens: ItemEstoque[]): ItemEstoque[] {
  return itens.filter((item) => typeof item.estoqueMinimo === 'number' && item.quantidadeAtual <= item.estoqueMinimo!);
}

export function buscarItens(itens: ItemEstoque[], termo: string): ItemEstoque[] {
  const t = termo.trim().toLowerCase();
  if (!t) return itens;
  return itens.filter(
    (item) => item.nome.toLowerCase().includes(t) || (item.categoria || '').toLowerCase().includes(t)
  );
}
