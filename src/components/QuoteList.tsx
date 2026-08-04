import React, { useState } from 'react';
import { Quote } from '../types';
import {
  FileText,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  Search,
  PlusCircle,
  Calendar,
  Phone,
  ArrowRight,
  MessageCircle
} from 'lucide-react';

interface QuoteListProps {
  quotes: Quote[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onNewQuote: () => void;
  onViewPDF: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (quoteId: string, newStatus: Quote['status']) => Promise<void>;
}

export const QuoteList: React.FC<QuoteListProps> = ({
  quotes,
  searchTerm,
  onSearchChange,
  onNewQuote,
  onViewPDF,
  onEdit,
  onDelete,
  onUpdateStatus,
}) => {
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('todos');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('pt-BR');
    } catch {
      return isoStr;
    }
  };

  // Filter logic
  const filteredQuotes = quotes.filter((q) => {
    const searchLower = searchTerm.toLowerCase().trim();

    let matchesSearch = true;
    if (searchLower) {
      matchesSearch =
        (q.customerName && q.customerName.toLowerCase().includes(searchLower)) ||
        (q.codeNumber && q.codeNumber.toString().includes(searchLower)) ||
        (q.customerPhone && q.customerPhone.toLowerCase().includes(searchLower)) ||
        (q.customerEmail && q.customerEmail.toLowerCase().includes(searchLower)) ||
        (q.customerAddress && q.customerAddress.toLowerCase().includes(searchLower)) ||
        (q.items && q.items.some((item) => item.productName && item.productName.toLowerCase().includes(searchLower)));
    }

    if (!matchesSearch) return false;

    if (activeStatusFilter === 'todos') return true;
    return q.status === activeStatusFilter;
  });

  // Calculate high-level financial overview metrics
  const totalInQuotes = quotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
  const totalDepositsCollected = quotes
    .filter((q) => q.depositPaid)
    .reduce((sum, q) => sum + (q.depositAmount || q.totalAmount / 2), 0);
  const totalRemainingPending = quotes
    .filter((q) => q.status !== 'concluido' && q.status !== 'gerado')
    .reduce((sum, q) => sum + (q.remainingAmount || q.totalAmount / 2), 0);

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'gerado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Gerado</span>
          </span>
        );
      case 'aprovado_50':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            <span>50% Entrada Pago</span>
          </span>
        );
      case 'aguardando_material':
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Aguardando Material</span>
          </span>
        );
      case 'pronto_instalacao':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pronto p/ Instalação</span>
          </span>
        );
      case 'concluido':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Concluído (100% Pago)</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total em Orçamentos</p>
          <p className="text-2xl font-black font-mono text-slate-900 mt-1">
            {formatCurrency(totalInQuotes)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{quotes.length} orçamentos registrados</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Entradas Recebidas (50%)</p>
          <p className="text-2xl font-black font-mono text-amber-700 mt-1">
            {formatCurrency(totalDepositsCollected)}
          </p>
          <p className="text-[11px] text-amber-600 mt-1">Valores congelados no caixa</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">A Receber Pós-Obra (50%)</p>
          <p className="text-2xl font-black font-mono text-blue-700 mt-1">
            {formatCurrency(totalRemainingPending)}
          </p>
          <p className="text-[11px] text-blue-600 mt-1">Saldo restante aguardando instalação</p>
        </div>

      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'gerado', label: 'Gerados' },
            { id: 'aprovado_50', label: 'Entrada (50%)' },
            { id: 'aguardando_material', label: 'Ag. Material' },
            { id: 'pronto_instalacao', label: 'Ag. Instalação' },
            { id: 'concluido', label: 'Concluídos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & New Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar cliente, pedido #, telefone, e-mail..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={onNewQuote}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Novo Orçamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>

      </div>

      {/* Active Search Banner */}
      {searchTerm && (
        <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 px-4 py-2.5 rounded-xl text-xs text-blue-900 font-medium">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600" />
            <span>Exibindo <strong>{filteredQuotes.length}</strong> orçamento{filteredQuotes.length !== 1 ? 's' : ''} para a busca: <strong>"{searchTerm}"</strong></span>
          </div>
          <button
            onClick={() => onSearchChange('')}
            className="text-blue-700 hover:text-blue-900 underline font-bold text-xs cursor-pointer"
          >
            Limpar busca
          </button>
        </div>
      )}

      {/* Quotes List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredQuotes.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-800">Nenhum orçamento encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Clique no botão "Novo Orçamento" acima para criar um orçamento completo com layout oficial para seu cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="p-3.5 w-[90px]">PEDIDO</th>
                  <th className="p-3.5">CLIENTE</th>
                  <th className="p-3.5 text-center w-[110px]">DATA</th>
                  <th className="p-3.5 text-center w-[160px]">STATUS</th>
                  <th className="p-3.5 text-right w-[120px]">TOTAL (R$)</th>
                  <th className="p-3.5 text-right w-[120px]">ENTRADA (50%)</th>
                  <th className="p-3.5 text-center w-[140px]">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Code Number */}
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      #{q.codeNumber}
                    </td>

                    {/* Customer Info */}
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900 text-sm">{q.customerName}</p>
                      <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {q.customerPhone}
                        </span>
                        {q.items?.length > 0 && (
                          <span className="truncate max-w-[200px]" title={q.items.map((i) => i.productName).join(', ')}>
                            • {q.items.length} item{q.items.length > 1 ? 's' : ''} ({q.items[0].productName})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="p-3.5 text-center text-slate-600 font-mono">
                      {formatDate(q.date)}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      {getStatusBadge(q.status)}
                    </td>

                    {/* Total Amount */}
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(q.totalAmount)}
                    </td>

                    {/* 50% Deposit Amount & indicator */}
                    <td className="p-3.5 text-right font-mono">
                      <p className="font-bold text-amber-700">
                        {formatCurrency(q.depositAmount || q.totalAmount / 2)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {q.depositPaid ? '✓ Pago' : 'Pendente'}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        
                        {/* View PDF */}
                        <button
                          onClick={() => onViewPDF(q)}
                          className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Gerar PDF / Imprimir"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* WhatsApp Quick Send */}
                        <button
                          onClick={() => {
                            let rawPhone = q.customerPhone.replace(/\D/g, '');
                            if (!rawPhone) {
                              alert('Telefone do cliente não cadastrado!');
                              return;
                            }
                            if (rawPhone.length === 10 || rawPhone.length === 11) {
                              rawPhone = `55${rawPhone}`;
                            }
                            const msg = `*ORÇAMENTO #${q.codeNumber}*\nOlá ${q.customerName}, seu orçamento no valor total de ${formatCurrency(q.totalAmount)} está disponível! Entre em contato para tirarmos dúvidas.`;
                            window.open(`https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Enviar via WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEdit(q)}
                          className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar Orçamento"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Status progression quick buttons */}
                        {q.status === 'gerado' && (
                          <button
                            onClick={() => onUpdateStatus(q.id, 'aprovado_50')}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Aprovar (Registrar 50% Entrada)"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}

                        {q.status === 'aprovado_50' && (
                          <button
                            onClick={() => onUpdateStatus(q.id, 'aguardando_material')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Aguardando Material (Pedido na Têmpera)"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}

                        {(q.status === 'aguardando_material' || q.status === 'em_andamento') && (
                          <button
                            onClick={() => onUpdateStatus(q.id, 'pronto_instalacao')}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Material Chegou (Pronto p/ Instalar)"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}

                        {q.status === 'pronto_instalacao' && (
                          <button
                            onClick={() => onUpdateStatus(q.id, 'concluido')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Instalado no Cliente (Quitar Saldo 50%)"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja excluir o orçamento #${q.codeNumber}?`)) {
                              onDelete(q.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Orçamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
