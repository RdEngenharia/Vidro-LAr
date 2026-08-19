import React, { useState, useEffect, useCallback } from 'react';
import { Customer, Quote, ItemEstoque, MovimentoEstoque, UnidadeEstoque } from '../types';
import { getEstoqueItens, saveEstoqueItem, deleteEstoqueItem, getMovimentosDoItem, addMovimentoEstoque, deleteMovimentoEstoque, getTodosMovimentosEstoque } from '../lib/db';
import {
  criarItemEstoque,
  registrarEntrada,
  registrarSaida,
  desfazerMovimento,
  valorTotalEstoque,
  itensComEstoqueBaixo,
  buscarItens,
} from '../lib/estoqueCalc';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  Package,
  Loader2,
  Pencil,
  Undo2,
  Users,
  Calendar,
  ArrowDownCircle,
} from 'lucide-react';

const UNIDADES: { valor: UnidadeEstoque; rotulo: string }[] = [
  { valor: 'un', rotulo: 'Unidade (un)' },
  { valor: 'm', rotulo: 'Metro (m)' },
  { valor: 'm2', rotulo: 'Metro Quadrado (m²)' },
  { valor: 'kg', rotulo: 'Quilo (kg)' },
  { valor: 'l', rotulo: 'Litro (l)' },
  { valor: 'cx', rotulo: 'Caixa (cx)' },
  { valor: 'rolo', rotulo: 'Rolo' },
  { valor: 'pc', rotulo: 'Peça (pc)' },
];

const emReais = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const campo = 'w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900';
const rotuloCampo = 'block text-xs font-semibold text-slate-700 mb-1';

type Aba = 'itens' | 'consumo' | 'relatorio';

interface EstoqueProps {
  tenantId: string;
  customers: Customer[];
  quotes: Quote[];
}

export const Estoque: React.FC<EstoqueProps> = ({ tenantId, customers, quotes }) => {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>('itens');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await getEstoqueItens(tenantId);
      setItens(lista);
    } catch (err) {
      console.error('Estoque: falha ao carregar itens', err);
    } finally {
      setCarregando(false);
    }
  }, [tenantId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const persistirItem = async (item: ItemEstoque) => {
    setItens((atual) => {
      const semDuplicata = atual.filter((i) => i.id !== item.id);
      return [...semDuplicata, item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    await saveEstoqueItem(item);
  };

  const estoqueBaixo = itensComEstoqueBaixo(itens);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Estoque
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {aba === 'itens' && 'O material que você comprou e ainda tem guardado.'}
            {aba === 'consumo' && 'Dê baixa no que foi usado, vinculado a um cliente ou orçamento.'}
            {aba === 'relatorio' && 'Para onde foi cada baixa, por cliente e por período.'}
          </p>
        </div>
        <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {([
            ['itens', 'Itens'],
            ['consumo', 'Consumo'],
            ['relatorio', 'Relatório'],
          ] as [Aba, string][]).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                aba === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Carregando estoque...</span>
        </div>
      ) : (
        <>
          {aba === 'itens' && (
            <AbaItens tenantId={tenantId} itens={itens} estoqueBaixo={estoqueBaixo} persistirItem={persistirItem} setItens={setItens} />
          )}
          {aba === 'consumo' && (
            <AbaConsumo tenantId={tenantId} itens={itens} customers={customers} quotes={quotes} persistirItem={persistirItem} />
          )}
          {aba === 'relatorio' && <AbaRelatorio tenantId={tenantId} itens={itens} customers={customers} />}
        </>
      )}
    </div>
  );
};

/* ============================================================================
   ABA 1 — ITENS
   ============================================================================ */

function AbaItens({
  tenantId,
  itens,
  estoqueBaixo,
  persistirItem,
  setItens,
}: {
  tenantId: string;
  itens: ItemEstoque[];
  estoqueBaixo: ItemEstoque[];
  persistirItem: (item: ItemEstoque) => Promise<void>;
  setItens: React.Dispatch<React.SetStateAction<ItemEstoque[]>>;
}) {
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [movimentosPorItem, setMovimentosPorItem] = useState<Record<string, MovimentoEstoque[]>>({});
  const [carregandoMovimentos, setCarregandoMovimentos] = useState(false);

  const [showNovoItem, setShowNovoItem] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [unidadeNova, setUnidadeNova] = useState<UnidadeEstoque>('un');
  const [categoriaNova, setCategoriaNova] = useState('');
  const [minimoNovo, setMinimoNovo] = useState('');

  const [itemEditando, setItemEditando] = useState<ItemEstoque | null>(null);
  const [itemEntrada, setItemEntrada] = useState<ItemEstoque | null>(null);
  const [qtdEntrada, setQtdEntrada] = useState('');
  const [custoEntrada, setCustoEntrada] = useState('');
  const [freteEntrada, setFreteEntrada] = useState('');
  const [erro, setErro] = useState('');

  const listaFiltrada = buscarItens(itens, busca);
  const valorTotal = valorTotalEstoque(itens);

  const toggleExpandir = async (item: ItemEstoque) => {
    if (expandido === item.id) {
      setExpandido(null);
      return;
    }
    setExpandido(item.id);
    if (!movimentosPorItem[item.id]) {
      setCarregandoMovimentos(true);
      const movs = await getMovimentosDoItem(tenantId, item.id);
      setMovimentosPorItem((atual) => ({ ...atual, [item.id]: movs }));
      setCarregandoMovimentos(false);
    }
  };

  const handleCriarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!nomeNovo.trim()) return;
    if (itens.some((i) => i.nome.trim().toLowerCase() === nomeNovo.trim().toLowerCase())) {
      setErro('Já existe um item com esse nome.');
      return;
    }
    const novo = criarItemEstoque({
      tenantId,
      nome: nomeNovo,
      unidade: unidadeNova,
      categoria: categoriaNova || undefined,
      estoqueMinimo: minimoNovo ? Number(minimoNovo) : undefined,
    });
    await persistirItem(novo);
    setNomeNovo('');
    setCategoriaNova('');
    setMinimoNovo('');
    setUnidadeNova('un');
    setShowNovoItem(false);
  };

  const handleEditarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditando) return;
    await persistirItem({ ...itemEditando, atualizadoEm: new Date().toISOString() });
    setItemEditando(null);
  };

  const handleRegistrarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!itemEntrada) return;
    const quantidade = Number(String(qtdEntrada).replace(',', '.'));
    const custoUnitario = Number(String(custoEntrada).replace(',', '.'));
    const frete = Number(String(freteEntrada || '0').replace(',', '.'));
    if (!quantidade || quantidade <= 0) {
      setErro('Informe a quantidade comprada.');
      return;
    }
    if (!custoUnitario || custoUnitario <= 0) {
      setErro('Informe quanto pagou por unidade.');
      return;
    }

    const hoje = new Date().toLocaleDateString('pt-BR');
    const { itemAtualizado, movimento } = registrarEntrada(itemEntrada, { quantidade, custoUnitario, frete, data: hoje });
    await persistirItem(itemAtualizado);
    await addMovimentoEstoque(tenantId, itemEntrada.id, movimento);
    setMovimentosPorItem((atual) => ({ ...atual, [itemEntrada.id]: [movimento, ...(atual[itemEntrada.id] || [])] }));

    setItemEntrada(null);
    setQtdEntrada('');
    setCustoEntrada('');
    setFreteEntrada('');
  };

  const handleDesfazerUltimo = async (item: ItemEstoque) => {
    const movs = movimentosPorItem[item.id] || (await getMovimentosDoItem(tenantId, item.id));
    const ultimo = movs[0]; // mais recente primeiro
    if (!ultimo) return;
    const msg =
      ultimo.tipo === 'entrada'
        ? `Desfazer a compra de ${ultimo.quantidade} ${item.unidade} de "${item.nome}"? O custo médio volta a ser o que era antes desta compra.`
        : `Desfazer a baixa de ${ultimo.quantidade} ${item.unidade} de "${item.nome}"${ultimo.clienteNome ? ` para ${ultimo.clienteNome}` : ''}? A quantidade volta para o estoque.`;
    if (!window.confirm(msg)) return;

    const itemRestaurado = desfazerMovimento(item, ultimo);
    await persistirItem(itemRestaurado);
    await deleteMovimentoEstoque(tenantId, item.id, ultimo.id);
    setMovimentosPorItem((atual) => ({ ...atual, [item.id]: (atual[item.id] || []).slice(1) }));
  };

  const handleExcluirItem = async (item: ItemEstoque) => {
    const movs = movimentosPorItem[item.id] ?? (await getMovimentosDoItem(tenantId, item.id));
    if (movs.length > 0) {
      alert('Este item já tem movimentação — não dá para excluir, só zerar registrando um ajuste.');
      return;
    }
    if (!window.confirm(`Excluir "${item.nome}" do estoque?`)) return;
    setItens((atual) => atual.filter((i) => i.id !== item.id));
    await deleteEstoqueItem(item.id, tenantId);
  };

  return (
    <div className="space-y-5">
      {/* Resumo + busca + ações */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block">Valor em estoque</span>
            <span className="text-xl font-black">{emReais(valorTotal)}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar item por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`${campo} pl-10`}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowNovoItem(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 text-blue-400" /> Novo Item
          </button>
        </div>
      </div>

      {estoqueBaixo.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-semibold leading-relaxed">
            {estoqueBaixo.length === 1
              ? `"${estoqueBaixo[0].nome}" está no limite mínimo — hora de comprar mais.`
              : `${estoqueBaixo.length} itens estão no limite mínimo ou abaixo: ${estoqueBaixo.map((i) => i.nome).join(', ')}.`}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {listaFiltrada.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">
              {itens.length === 0 ? 'Nenhum item cadastrado ainda.' : 'Nada encontrado para essa busca.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {listaFiltrada.map((item) => {
              const baixo = typeof item.estoqueMinimo === 'number' && item.quantidadeAtual <= item.estoqueMinimo;
              const aberto = expandido === item.id;
              const movs = (movimentosPorItem[item.id] || []).slice(0, 6);
              return (
                <div key={item.id}>
                  <div
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpandir(item)}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {aberto ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                          {item.nome}
                          {baixo && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[9px] font-bold uppercase">
                              <AlertTriangle className="w-2.5 h-2.5" /> Baixo
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {item.categoria ? `${item.categoria} · ` : ''}
                          {item.quantidadeAtual} {item.unidade} · custo médio {emReais(item.custoMedio)}/{item.unidade}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm font-bold text-slate-900 mr-2">{emReais(item.quantidadeAtual * item.custoMedio)}</span>
                      <button
                        onClick={() => setItemEntrada(item)}
                        title="Registrar compra"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setItemEditando(item)}
                        title="Editar"
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleExcluirItem(item)}
                        title="Excluir"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="flex items-center justify-between pt-3 pb-2">
                        <p className="text-[11px] font-bold uppercase text-slate-400">Últimas movimentações</p>
                        {movs.length > 0 && (
                          <button
                            onClick={() => handleDesfazerUltimo(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            <Undo2 className="w-3 h-3" /> Desfazer última
                          </button>
                        )}
                      </div>
                      {carregandoMovimentos ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : movs.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhuma movimentação ainda.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {movs.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                              <span className="text-slate-600">
                                {m.data} · {m.tipo === 'entrada' ? 'Compra' : `Baixa${m.clienteNome ? ` — ${m.clienteNome}` : ''}`}
                              </span>
                              <span className={`font-bold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {m.tipo === 'entrada' ? '+' : '−'}
                                {m.quantidade} {item.unidade}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Novo Item */}
      {showNovoItem && (
        <ModalBase titulo="Novo Item de Estoque" onClose={() => setShowNovoItem(false)}>
          <form onSubmit={handleCriarItem} className="space-y-3">
            {erro && <ErroTexto texto={erro} />}
            <div>
              <label className={rotuloCampo}>Nome</label>
              <input type="text" required value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} className={campo} placeholder="Ex: Vidro Temperado 8mm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotuloCampo}>Unidade</label>
                <select value={unidadeNova} onChange={(e) => setUnidadeNova(e.target.value as UnidadeEstoque)} className={campo}>
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>{u.rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={rotuloCampo}>Categoria</label>
                <input type="text" value={categoriaNova} onChange={(e) => setCategoriaNova(e.target.value)} className={campo} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <label className={rotuloCampo}>Estoque Mínimo (opcional)</label>
              <input type="number" step="0.01" value={minimoNovo} onChange={(e) => setMinimoNovo(e.target.value)} className={campo} placeholder="Avisa quando chegar nesse limite" />
            </div>
            <BotaoSalvar texto="Criar Item" />
          </form>
        </ModalBase>
      )}

      {/* Modal: Editar Item */}
      {itemEditando && (
        <ModalBase titulo="Editar Item" onClose={() => setItemEditando(null)}>
          <form onSubmit={handleEditarItem} className="space-y-3">
            <div>
              <label className={rotuloCampo}>Nome</label>
              <input
                type="text"
                required
                value={itemEditando.nome}
                onChange={(e) => setItemEditando({ ...itemEditando, nome: e.target.value })}
                className={campo}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotuloCampo}>Unidade</label>
                <select
                  value={itemEditando.unidade}
                  onChange={(e) => setItemEditando({ ...itemEditando, unidade: e.target.value as UnidadeEstoque })}
                  className={campo}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>{u.rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={rotuloCampo}>Categoria</label>
                <input
                  type="text"
                  value={itemEditando.categoria || ''}
                  onChange={(e) => setItemEditando({ ...itemEditando, categoria: e.target.value })}
                  className={campo}
                />
              </div>
            </div>
            <div>
              <label className={rotuloCampo}>Estoque Mínimo</label>
              <input
                type="number"
                step="0.01"
                value={itemEditando.estoqueMinimo ?? ''}
                onChange={(e) => setItemEditando({ ...itemEditando, estoqueMinimo: e.target.value ? Number(e.target.value) : undefined })}
                className={campo}
              />
            </div>
            <BotaoSalvar texto="Salvar Alterações" />
          </form>
        </ModalBase>
      )}

      {/* Modal: Registrar Compra (Entrada) */}
      {itemEntrada && (
        <ModalBase titulo={`Registrar Compra — ${itemEntrada.nome}`} onClose={() => setItemEntrada(null)}>
          <form onSubmit={handleRegistrarEntrada} className="space-y-3">
            {erro && <ErroTexto texto={erro} />}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotuloCampo}>Quantidade Comprada</label>
                <input type="text" inputMode="decimal" value={qtdEntrada} onChange={(e) => setQtdEntrada(e.target.value)} className={campo} placeholder={`Ex: 10 ${itemEntrada.unidade}`} />
              </div>
              <div>
                <label className={rotuloCampo}>Custo por {itemEntrada.unidade}</label>
                <input type="text" inputMode="decimal" value={custoEntrada} onChange={(e) => setCustoEntrada(e.target.value)} className={campo} placeholder="R$" />
              </div>
            </div>
            <div>
              <label className={rotuloCampo}>Frete (opcional)</label>
              <input type="text" inputMode="decimal" value={freteEntrada} onChange={(e) => setFreteEntrada(e.target.value)} className={campo} placeholder="R$ 0,00" />
            </div>
            <p className="text-[11px] text-slate-400">
              O custo médio de "{itemEntrada.nome}" é recalculado automaticamente, ponderando o que já tinha em estoque com esta nova compra (frete incluso).
            </p>
            <BotaoSalvar texto="Registrar Compra" />
          </form>
        </ModalBase>
      )}
    </div>
  );
}

/* ============================================================================
   ABA 2 — CONSUMO (baixa vinculada a cliente/orçamento)
   ============================================================================ */

type LinhaConsumo = { id: string; itemId: string; quantidade: string };
const novaLinhaConsumo = (): LinhaConsumo => ({ id: `lc_${Date.now()}_${Math.random()}`, itemId: '', quantidade: '' });

function AbaConsumo({
  tenantId,
  itens,
  customers,
  quotes,
  persistirItem,
}: {
  tenantId: string;
  itens: ItemEstoque[];
  customers: Customer[];
  quotes: Quote[];
  persistirItem: (item: ItemEstoque) => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [linhas, setLinhas] = useState<LinhaConsumo[]>([novaLinhaConsumo()]);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');

  const clienteSelecionado = customers.find((c) => c.id === clienteId);
  const orcamentosDoCliente = quotes.filter((q) => !clienteId || q.customerId === clienteId);

  const alterarLinha = (id: string, mudanca: Partial<LinhaConsumo>) => {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));
  };
  const removerLinha = (id: string) => {
    setLinhas((atual) => (atual.length <= 1 ? atual : atual.filter((l) => l.id !== id)));
  };

  const linhasValidas = linhas
    .map((l) => ({ ...l, item: itens.find((i) => i.id === l.itemId), qtd: Number(String(l.quantidade).replace(',', '.')) }))
    .filter((l) => l.item && l.qtd > 0);

  const totalConsumo = linhasValidas.reduce((s, l) => s + (l.item ? l.qtd * l.item.custoMedio : 0), 0);
  const quoteSelecionado = quotes.find((q) => q.id === quoteId);

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (!clienteSelecionado) {
      setErro('Selecione o cliente.');
      return;
    }
    if (linhasValidas.length === 0) {
      setErro('Adicione ao menos um item com quantidade.');
      return;
    }
    const semEstoque = linhasValidas.find((l) => l.item && l.qtd > l.item.quantidadeAtual);
    if (semEstoque) {
      setErro(`"${semEstoque.item!.nome}" só tem ${semEstoque.item!.quantidadeAtual} ${semEstoque.item!.unidade} em estoque.`);
      return;
    }

    setEnviando(true);
    try {
      const hoje = new Date().toLocaleDateString('pt-BR');
      for (const l of linhasValidas) {
        if (!l.item) continue;
        const { itemAtualizado, movimento } = registrarSaida(l.item, {
          quantidade: l.qtd,
          data: hoje,
          clienteId: clienteSelecionado.id,
          clienteNome: clienteSelecionado.name,
          quoteId: quoteSelecionado?.id,
          quoteCodeNumber: quoteSelecionado?.codeNumber,
        });
        await persistirItem(itemAtualizado);
        await addMovimentoEstoque(tenantId, l.item.id, movimento);
      }
      setSucesso(`Consumo registrado para ${clienteSelecionado.name} — ${emReais(totalConsumo)} em material.`);
      setClienteId('');
      setQuoteId('');
      setLinhas([novaLinhaConsumo()]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleRegistrar} className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {erro && <ErroTexto texto={erro} />}
      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl">{sucesso}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={rotuloCampo}>
            <Users className="w-3 h-3 inline mr-1 -mt-0.5" />Cliente
          </label>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setQuoteId('');
            }}
            className={campo}
          >
            <option value="">Selecione...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotuloCampo}>Orçamento vinculado (opcional)</label>
          <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className={campo} disabled={!clienteId}>
            <option value="">Nenhum — só o cliente</option>
            {orcamentosDoCliente.map((q) => (
              <option key={q.id} value={q.id}>#{q.codeNumber} — {emReais(q.totalAmount)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={rotuloCampo}>
          <Calendar className="w-3 h-3 inline mr-1 -mt-0.5" />Itens consumidos
        </label>
        <div className="space-y-2">
          {linhas.map((l) => {
            const itemDaLinha = itens.find((i) => i.id === l.itemId);
            return (
              <div key={l.id} className="flex gap-2">
                <select value={l.itemId} onChange={(e) => alterarLinha(l.id, { itemId: e.target.value })} className={`${campo} flex-1`}>
                  <option value="">Selecione o item...</option>
                  {itens.map((i) => (
                    <option key={i.id} value={i.id}>{i.nome} ({i.quantidadeAtual} {i.unidade} disponível)</option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={l.quantidade}
                  onChange={(e) => alterarLinha(l.id, { quantidade: e.target.value })}
                  placeholder={itemDaLinha ? itemDaLinha.unidade : 'Qtd'}
                  className={`${campo} w-28 shrink-0`}
                />
                <button
                  type="button"
                  onClick={() => removerLinha(l.id)}
                  disabled={linhas.length <= 1}
                  className="shrink-0 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLinhas((atual) => [...atual, novaLinhaConsumo()])}
          className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar item
        </button>
      </div>

      {linhasValidas.length > 0 && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Valor do consumo (custo do material)</span>
          <span className="text-sm font-bold text-slate-900">{emReais(totalConsumo)}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
      >
        {enviando ? 'Registrando...' : 'Registrar Consumo'}
      </button>
    </form>
  );
}

/* ============================================================================
   ABA 3 — RELATÓRIO
   ============================================================================ */

function AbaRelatorio({ tenantId, itens, customers }: { tenantId: string; itens: ItemEstoque[]; customers: Customer[] }) {
  const [carregando, setCarregando] = useState(true);
  const [todasBaixas, setTodasBaixas] = useState<Array<{ item: ItemEstoque; movimento: MovimentoEstoque }>>([]);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const todos = await getTodosMovimentosEstoque(tenantId, itens);
      setTodasBaixas(todos.filter((t) => t.movimento.tipo === 'saida'));
      setCarregando(false);
    })();
  }, [tenantId, itens]);

  const paraISO = (dataBr: string) => {
    if (!dataBr) return '';
    const [d, m, a] = dataBr.split('/');
    return d && m && a ? `${a}-${m}-${d}` : '';
  };

  const baixasFiltradas = todasBaixas.filter(({ movimento }) => {
    if (clienteFiltro && movimento.clienteId !== clienteFiltro) return false;
    const dataISO = paraISO(movimento.data);
    if (de && dataISO < de) return false;
    if (ate && dataISO > ate) return false;
    return true;
  });

  const totalGeral = baixasFiltradas.reduce((s, { movimento }) => s + (movimento.valorTotal || 0), 0);

  const porCliente = Object.values(
    baixasFiltradas.reduce((acc, { movimento }) => {
      const chave = movimento.clienteId || movimento.clienteNome || 'sem-cliente';
      if (!acc[chave]) acc[chave] = { clienteNome: movimento.clienteNome || 'Sem cliente', total: 0 };
      acc[chave].total += movimento.valorTotal || 0;
      return acc;
    }, {} as Record<string, { clienteNome: string; total: number }>)
  ).sort((a, b) => b.total - a.total);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Carregando relatório...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className={rotuloCampo}>De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={campo} />
        </div>
        <div className="flex-1">
          <label className={rotuloCampo}>Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
        </div>
        <div className="flex-1">
          <label className={rotuloCampo}>Cliente</label>
          <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total baixado no período</span>
          <span className="text-2xl font-black">{emReais(totalGeral)}</span>
          <p className="text-[11px] text-slate-400 mt-1">{baixasFiltradas.length} baixa{baixasFiltradas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Por cliente</span>
          {porCliente.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma baixa no período.</p>
          ) : (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {porCliente.map((c) => (
                <div key={c.clienteNome} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium truncate">{c.clienteNome}</span>
                  <span className="font-bold text-slate-800 shrink-0 ml-2">{emReais(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {baixasFiltradas.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Nenhuma baixa encontrada para este filtro.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
            {baixasFiltradas.map(({ item, movimento }) => (
              <div key={movimento.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{movimento.clienteNome || 'Sem cliente'}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {movimento.data} · {item.nome} · {movimento.quantidade} {item.unidade}
                    {movimento.quoteCodeNumber ? ` · Orçamento #${movimento.quoteCodeNumber}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold text-rose-600 shrink-0">−{emReais(movimento.valorTotal || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   Componentes auxiliares
   ============================================================================ */

function ModalBase({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <h3 className="font-bold text-sm">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ErroTexto({ texto }: { texto: string }) {
  return <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">{texto}</div>;
}

function BotaoSalvar({ texto }: { texto: string }) {
  return (
    <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">
      {texto}
    </button>
  );
}
