import React from 'react';
import { Quote, CompanySettings } from '../types';
import { Printer, Download, ArrowLeft, CheckCircle2, Clock, DollarSign, MessageCircle, Receipt } from 'lucide-react';
import { generateQuotePDF, printQuoteDirectly } from '../lib/pdfGenerator';
import { logError } from '../lib/logger';

interface QuotePDFViewProps {
  quote: Quote;
  companySettings?: CompanySettings;
  onBack: () => void;
  onUpdateStatus?: (newStatus: Quote['status']) => void;
  onEmitBoleto?: () => void;
}

export const QuotePDFView: React.FC<QuotePDFViewProps> = ({
  quote,
  companySettings,
  onBack,
  onUpdateStatus,
  onEmitBoleto,
}) => {

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const formatDimension = (val: number) => {
    return (val || 0).toFixed(3).replace('.', ',');
  };

  // Format date like "quarta-feira, 15 de julho de 2026"
  const formatDateFull = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return isoDate;
    }
  };

  const handleDownloadPDF = async () => {
    try {
      await generateQuotePDF('pdf-quote-canvas', `Orcamento_${quote.codeNumber}_${quote.customerName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      logError('GENERATE_PDF', e, { quoteId: quote.id, codeNumber: quote.codeNumber });
      alert('Erro ao gerar PDF. Detalhes técnicos foram registrados no Painel do Desenvolvedor.');
    }
  };

  const handleSendWhatsApp = () => {
    let rawPhone = quote.customerPhone.replace(/\D/g, '');
    if (!rawPhone) {
      alert('Número de telefone do cliente não foi informado ou está inválido!');
      return;
    }
    if (rawPhone.length === 10 || rawPhone.length === 11) {
      rawPhone = `55${rawPhone}`;
    }

    const compName = companySettings?.companyName || 'Vidraçaria Coroa Alta';
    const itemsList = quote.items
      .map(
        (it, idx) =>
          `*${idx + 1}.* ${it.quantity}x ${it.productName} (${formatDimension(it.heightM)}m x ${formatDimension(
            it.widthM
          )}m, ${it.thicknessMm}mm ${it.color}) - Total: ${formatCurrency(it.totalPrice)}`
      )
      .join('\n');

    const cardAmt = quote.cardTotalAmount || quote.totalAmount;
    const installmentsText =
      quote.maxInstallmentsCard && quote.maxInstallmentsCard > 1
        ? `*Total Cartão:* ${formatCurrency(cardAmt)} (${quote.maxInstallmentsCard}x de ${formatCurrency(
            cardAmt / quote.maxInstallmentsCard
          )})`
        : `*Total Cartão:* ${formatCurrency(cardAmt)}`;

    const hasPaymentSplits = !!(quote.paymentSplits && quote.paymentSplits.length > 0);

    const splitsText = hasPaymentSplits
      ? `\n🔀 *FORMA DE PAGAMENTO ESCOLHIDA:*
` + quote.paymentSplits!.map(s => `• *${s.method}:* ${formatCurrency(s.amount)}${s.description ? ` (${s.description})` : ''}`).join('\n')
      : '';

    // A condição genérica de Entrada+Saldo só é exibida quando NÃO existe uma Divisão de
    // Pagamento explícita — evita contradizer a forma de pagamento realmente escolhida
    // (ex: mensagem dizer "50% a prazo" quando o cliente pagou 100% à vista no PIX).
    let depositText = '';
    if (!hasPaymentSplits) {
      const depositAmt = quote.depositAmount !== undefined ? quote.depositAmount : quote.totalAmount / 2;
      const remainingAmt = quote.remainingAmount !== undefined ? quote.remainingAmount : quote.totalAmount - depositAmt;
      const depositPct = quote.depositPercent !== undefined
        ? quote.depositPercent
        : (quote.totalAmount > 0 ? Math.round((depositAmt / quote.totalAmount) * 100) : 50);

      depositText = depositPct === 100
        ? `• *Pagamento:* 100% À Vista (${formatCurrency(quote.totalAmount)})`
        : `• *Entrada (${depositPct}% no pedido):* ${formatCurrency(depositAmt)}
• *Saldo A Prazo (${Math.max(0, 100 - depositPct)}%):* ${formatCurrency(remainingAmt)} ${quote.remainingPaymentNotes ? `(${quote.remainingPaymentNotes})` : ''}`;
    }

    // Assim como no orçamento visual: quando existe Divisão de Pagamento explícita, ela é a
    // única fonte de verdade — não oferecemos mais "12x no cartão" para quem escolheu PIX.
    const valuesSectionText = hasPaymentSplits
      ? `• *Valor Total:* ${formatCurrency(quote.totalAmount)}`
      : `• ${installmentsText}
• *À Vista (com desconto):* ${formatCurrency(quote.cashTotalAmount)}
${depositText}`;

    const message = `*${compName.toUpperCase()}*
*ORÇAMENTO / PEDIDO #${quote.codeNumber}*

Olá, *${quote.customerName}*! Segue a proposta de orçamento da sua obra:

📋 *ITENS DO PEDIDO:*
${itemsList}

💰 *VALORES & CONDIÇÕES:*
${valuesSectionText}${splitsText}
• *Acabamento:* ${quote.finishColor} ${quote.finishColorOther ? `(${quote.finishColorOther})` : ''}

📅 *Validade da proposta:* ${quote.validUntilDays || 15} dias.

Ficamos à disposição para agendar sua instalação!`;

    const url = `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Quick Action Buttons & Status Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Etapa:</span>
            <select
              value={quote.status}
              onChange={(e) => onUpdateStatus && onUpdateStatus(e.target.value as Quote['status'])}
              className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="gerado">1. Orçamento Gerado</option>
              <option value="aprovado_50">
                2. {((quote.paymentSplits && quote.paymentSplits.length === 1) || quote.depositPercent === 100)
                  ? 'Pagamento Total Recebido'
                  : 'Entrada 50% Paga'}
              </option>
              <option value="aguardando_material">3. Aguardando Material (Fábrica)</option>
              <option value="pronto_instalacao">4. Pronto p/ Instalação</option>
              <option value="concluido">5. Concluído (100% Quitados)</option>
            </select>

            {quote.status === 'gerado' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus('aprovado_50')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>
                  {(quote.paymentSplits && quote.paymentSplits.length === 1) || quote.depositPercent === 100
                    ? 'Registrar Pagamento Total (100%)'
                    : 'Registrar 50% Entrada'}
                </span>
              </button>
            )}

            {quote.status === 'aprovado_50' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus('aguardando_material')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pedir Material na Têmpera</span>
              </button>
            )}

            {(quote.status === 'aguardando_material' || quote.status === 'em_andamento') && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus('pronto_instalacao')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Material Chegou (Pronto p/ Instalar)</span>
              </button>
            )}

            {quote.status === 'pronto_instalacao' && onUpdateStatus && (
              <button
                onClick={() => onUpdateStatus('concluido')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Instalado (Quitar Restante)</span>
              </button>
            )}
          </div>

          {/* WhatsApp Button */}
          <button
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
            title="Enviar proposta via WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar WhatsApp</span>
          </button>

          {onEmitBoleto && (
            <button
              onClick={onEmitBoleto}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              title="Emitir boleto para este orçamento"
            >
              <Receipt className="w-4 h-4" />
              <span>Emitir Boleto</span>
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar PDF</span>
          </button>

          <button
            onClick={() => printQuoteDirectly('pdf-quote-canvas')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>



      {/* Main Printable PDF Canvas Container */}
      <div className="overflow-x-auto p-2 sm:p-6 bg-slate-100 rounded-xl print:p-0 print:bg-white">
        <div
          id="pdf-quote-canvas"
          className="mx-auto text-black p-5 max-w-[780px] border border-black font-sans leading-snug print:border-none print:shadow-none print:max-w-none shadow-xs"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}
        >
          {/* Header section matching Vidraçaria Coroa Alta layout */}
          <div className="flex justify-between items-start border-b-2 border-black pb-2.5" style={{ borderColor: '#000000' }}>
            {/* Left Brand Block */}
            <div className="flex items-center gap-3">
              {companySettings?.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt="Logo Vidraçaria"
                  className="h-[72px] w-auto object-contain max-w-[225px]"
                />
              ) : (
                <div className="border-2 border-black px-2.5 py-0.5 font-black tracking-tighter text-xl uppercase" style={{ borderColor: '#000000', color: '#000000' }}>
                  Vidraçaria <span style={{ color: '#1e3a8a' }}>PRO</span>
                </div>
              )}
              <div className="border-l-2 pl-2.5" style={{ borderColor: '#1e3a8a' }}>
                <p className="font-extrabold text-[10px] tracking-wider uppercase leading-tight" style={{ color: '#000000' }}>
                  {companySettings?.tagline || 'PORTAS • JANELAS • ESPELHOS • BOX & VIDROS'}
                </p>
              </div>
            </div>

            {/* Right Company Contact Block */}
            <div className="text-right text-[10px] font-bold leading-tight" style={{ color: '#000000' }}>
              <p>{companySettings?.address || 'Rua Tupiguás Nº 1500'}</p>
              <p>{companySettings?.cityState || 'Aldeia Stª Maria - Coroa Vermelha, BA'}</p>
              <p className="font-extrabold italic mt-0.5">Tudo em Vidros</p>
            </div>
          </div>

          {/* Title Banner */}
          <div className="mt-2 border-y-2 border-black py-1 px-2 flex justify-between items-center text-center" style={{ backgroundColor: '#ffffff', borderColor: '#000000' }}>
            <h2 className="font-black text-sm uppercase tracking-wider w-full text-center" style={{ color: '#000000' }}>
              ORÇAMENTO / PEDIDO DE MATERIAL #{quote.codeNumber}
            </h2>
          </div>
          <div className="text-right text-[10px] italic font-medium pt-1 pb-1.5" style={{ color: '#000000' }}>
            {formatDateFull(quote.date)}
          </div>

          {/* Customer & Contact Info Box */}
          <div className="border border-black text-[10.5px] font-bold leading-normal mb-2.5" style={{ borderColor: '#000000' }}>
            <div className="grid grid-cols-12 border-b border-black divide-x divide-black py-2 px-2.5 items-center" style={{ backgroundColor: '#f8fafc', borderColor: '#000000' }}>
              <div className="col-span-8 px-1 min-w-0">
                <span className="uppercase font-black">CLIENTE:</span> {quote.customerName}
              </div>
              <div className="col-span-4 px-1 min-w-0">
                <span className="uppercase font-black">FONE:</span> {quote.customerPhone}
              </div>
            </div>

            <div className="py-2 px-2.5 border-b border-black flex items-center min-w-0" style={{ borderColor: '#000000' }}>
              <span className="uppercase font-black mr-1.5 shrink-0">ENDEREÇO:</span>
              <span className="break-words">{quote.customerAddress}</span>
            </div>

            <div className="grid grid-cols-12 divide-x divide-black py-2 px-2.5 items-center" style={{ borderColor: '#000000' }}>
              <div className="col-span-8 px-1 min-w-0">
                <span className="uppercase font-black mr-1 shrink-0">E-MAIL:</span>
                <span className="break-all font-semibold">{quote.customerEmail || companySettings?.email || 'contato@vidracaria.com'}</span>
              </div>
              <div className="col-span-4 px-1 min-w-0">
                <span className="uppercase font-black font-mono mr-1">TEL:</span>
                <span className="font-mono">{companySettings?.phone || '(73) 99931-3164'}</span>
              </div>
            </div>
          </div>

          {/* Items Table - Centered cell vertical alignment & non-crowded vertical padding */}
          <div className="border border-black mb-2.5 overflow-x-auto" style={{ borderColor: '#000000' }}>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-black font-black uppercase text-center" style={{ backgroundColor: '#f1f5f9', color: '#000000', borderColor: '#000000' }}>
                  <th className="border-r border-black py-2 px-1.5 w-[35px] whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>QT</th>
                  <th className="border-r border-black py-2 px-1.5 w-[60px] whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>ALTURA</th>
                  <th className="border-r border-black py-2 px-1.5 w-[60px] whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>LARGURA</th>
                  <th className="border-r border-black py-2 px-1.5 w-[40px] whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>ESP.</th>
                  <th className="border-r border-black py-2 px-3 text-left whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>PRODUTO</th>
                  <th className="border-r border-black py-2 px-1.5 w-[65px] whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>COR</th>
                  <th className="border-r border-black py-2 px-2 text-right whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>UNIDADE</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap align-middle" style={{ verticalAlign: 'middle' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-semibold" style={{ color: '#000000', borderColor: '#000000' }}>
                {quote.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="border-r border-black py-2 px-1.5 text-center font-mono font-bold whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{item.quantity}</td>
                    <td className="border-r border-black py-2 px-1.5 text-center font-mono whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{formatDimension(item.heightM)}</td>
                    <td className="border-r border-black py-2 px-1.5 text-center font-mono whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{formatDimension(item.widthM)}</td>
                    <td className="border-r border-black py-2 px-1.5 text-center font-mono whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{item.thicknessMm}mm</td>
                    <td className="border-r border-black py-2 px-3 text-left font-bold uppercase whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{item.productName}</td>
                    <td className="border-r border-black py-2 px-1.5 text-center uppercase whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{item.color}</td>
                    <td className="border-r border-black py-2 px-2 text-right font-mono whitespace-nowrap align-middle" style={{ borderColor: '#000000', verticalAlign: 'middle' }}>{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold whitespace-nowrap align-middle" style={{ verticalAlign: 'middle' }}>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Payment Summary */}
          <div className="border border-black divide-y divide-black text-[10.5px] font-bold" style={{ borderColor: '#000000' }}>

            {/* Quando existe uma Divisão de Pagamento explícita, ela é a única fonte de verdade —
                não mostramos mais "Total até Nx no Cartão" nem "À Vista com desconto" genéricos,
                pois isso oferecia opções (ex: parcelamento no cartão) que o cliente nem escolheu. */}
            {quote.paymentSplits && quote.paymentSplits.length > 0 ? (
              <div className="flex justify-between items-center p-1.5" style={{ backgroundColor: '#f8fafc' }}>
                <span className="font-extrabold uppercase">Valor Total do Orçamento</span>
                <span className="font-mono text-xs font-black text-black">{formatCurrency(quote.totalAmount)}</span>
              </div>
            ) : (
              <>
                {/* Card Total with Installment Breakdown */}
                <div className="flex justify-between items-center p-1.5" style={{ backgroundColor: '#f8fafc' }}>
                  <span className="font-extrabold uppercase">
                    Total - Até {quote.maxInstallmentsCard || 12}x no Cartão
                    {quote.cardFeePercent ? ` (Taxa Máquina ${quote.cardFeePercent}%)` : ''}
                    {quote.maxInstallmentsCard && quote.maxInstallmentsCard > 1 && (
                      <span className="ml-1 font-mono font-semibold text-[9.5px]" style={{ color: '#334155' }}>
                        ({quote.maxInstallmentsCard}x de {formatCurrency((quote.cardTotalAmount || quote.totalAmount) / quote.maxInstallmentsCard)})
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs font-black text-black">
                    {formatCurrency(quote.cardTotalAmount || quote.totalAmount)}
                  </span>
                </div>

                {/* Cash Total */}
                <div className="flex justify-between items-center p-1.5">
                  <span className="font-extrabold uppercase">A Vista (com desconto)</span>
                  <span className="font-mono text-xs font-black text-black">{formatCurrency(quote.cashTotalAmount)}</span>
                </div>
              </>
            )}

            {/* Payment Splits & Permuta list if present */}
            {quote.paymentSplits && quote.paymentSplits.length > 0 && (
              <div className="p-1.5 border-t border-black text-[10px]" style={{ backgroundColor: '#faf5ff' }}>
                <div className="font-black uppercase pb-0.5 mb-1 border-b" style={{ color: '#3b0764', borderColor: '#e9d5ff' }}>
                  Divisão do Pagamento:
                </div>
                <div className="space-y-0.5">
                  {quote.paymentSplits.map((s, idx) => (
                    <div key={s.id || idx} className="flex justify-between font-mono">
                      <span>
                        <strong className="uppercase">{s.method}</strong>
                        {s.description ? ` - ${s.description}` : ''}
                      </span>
                      <span className="font-bold">{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finish Color Checkboxes */}
            <div className="p-1 text-center font-black uppercase text-[10px] tracking-wide" style={{ backgroundColor: '#f1f5f9' }}>
              COR DO ACABAMENTO - PRETO ({quote.finishColor === 'Preto' ? ' X ' : '   '}) - BRANCO ({quote.finishColor === 'Branco' ? ' X ' : '   '}) - FOSCO ({quote.finishColor === 'Fosco' ? ' X ' : '   '}) {quote.finishColor === 'Outro' ? `- OUTRO (${quote.finishColorOther || 'OUTRO'})` : ''}
            </div>

            {/* Validity Terms */}
            <div className="p-1 text-center text-[9.5px] font-semibold italic" style={{ color: '#334155' }}>
              {companySettings?.termsText || 'Proposta válida por 15 dias, ou até reajuste anunciado pelas tempêras.'}
            </div>
          </div>

          {/* Custom Deposit & Remaining Financial Status Notice */}
          {/* Só exibe esta condição genérica de Entrada+Saldo quando NÃO há uma Divisão de
              Pagamento explícita configurada — evita contradizer a forma de pagamento
              realmente escolhida (ex: mostrar "50% a prazo" quando o cliente pagou 100% à vista) */}
          {(!quote.paymentSplits || quote.paymentSplits.length === 0) && (
            <div className="mt-2.5 p-1.5 border border-black text-[10px] font-bold flex justify-between items-center" style={{ backgroundColor: '#f8fafc', borderColor: '#000000' }}>
              <div>
                <span className="uppercase font-black" style={{ color: '#0f172a' }}>Condição de Pagamento Vidraçaria:</span>
                <span className="ml-1.5 font-normal" style={{ color: '#1e293b' }}>
                  {(() => {
                    const depAmt = quote.depositAmount !== undefined ? quote.depositAmount : quote.totalAmount / 2;
                    const depPct = quote.depositPercent !== undefined
                      ? quote.depositPercent
                      : (quote.totalAmount > 0 ? Math.round((depAmt / quote.totalAmount) * 100) : 50);

                    if (depPct >= 100) return '100% À vista no pedido para faturamento e produção imediata.';
                    if (depPct <= 0) return `100% A prazo (${quote.remainingPaymentNotes || 'conforme combinado na instalação'}).`;
                    return `Entrada de ${depPct.toFixed(0)}% no pedido + Saldo a prazo de ${Math.max(0, 100 - depPct).toFixed(0)}% ${quote.remainingPaymentNotes ? `(${quote.remainingPaymentNotes})` : 'na conclusão da instalação'}.`;
                  })()}
                </span>
              </div>
              <div className="text-right font-mono font-black whitespace-nowrap pl-2">
                {(() => {
                  const depAmt = quote.depositAmount !== undefined ? quote.depositAmount : quote.totalAmount / 2;
                  const remAmt = quote.remainingAmount !== undefined ? quote.remainingAmount : quote.totalAmount - depAmt;
                  const depPct = quote.depositPercent !== undefined
                    ? quote.depositPercent
                    : (quote.totalAmount > 0 ? Math.round((depAmt / quote.totalAmount) * 100) : 50);

                  return (
                    <>
                      <div>Entrada ({depPct.toFixed(0)}%): {formatCurrency(depAmt)}</div>
                      <div>Saldo A Prazo: {formatCurrency(remAmt)}</div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-8 pt-3 border-t border-dashed grid grid-cols-2 gap-8 text-center text-[10px] font-bold uppercase" style={{ borderColor: '#94a3b8' }}>
            <div>
              <div className="border-b border-black mb-1 mx-6" style={{ borderColor: '#000000' }}></div>
              <p>{quote.customerName}</p>
              <p className="text-[8.5px] font-normal" style={{ color: '#475569' }}>Assinatura do Cliente</p>
            </div>
            <div>
              <div className="border-b border-black mb-1 mx-6" style={{ borderColor: '#000000' }}></div>
              <p>{companySettings?.companyName || 'Vidraçaria Coroa Alta'}</p>
              <p className="text-[8.5px] font-normal" style={{ color: '#475569' }}>Responsável Vidraçaria</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
