import React, { useState, useEffect } from 'react';
import { Quote, QuoteItem, Customer, Category, ProductPreset, CompanySettings, PaymentSplit, PaymentMethodType } from '../types';
import { useAuth } from '../lib/authContext';
import { genId } from '../lib/id';
import { Plus, Trash2, Save, UserPlus, Calculator, Info, Check, AlertCircle, CreditCard, Layers } from 'lucide-react';

interface QuoteFormProps {
  initialQuote?: Quote | null;
  customers: Customer[];
  categories: Category[];
  products: ProductPreset[];
  companySettings?: CompanySettings;
  onSave: (quote: Quote) => Promise<void>;
  onCancel: () => void;
  onAddCustomerClick: () => void;
}

export const QuoteForm: React.FC<QuoteFormProps> = ({
  initialQuote,
  customers,
  categories,
  products,
  companySettings,
  onSave,
  onCancel,
  onAddCustomerClick,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || 'tenant_default';

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialQuote?.customerId || '');
  const [customerName, setCustomerName] = useState(initialQuote?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialQuote?.customerPhone || '');
  const [customerAddress, setCustomerAddress] = useState(initialQuote?.customerAddress || '');
  const [customerEmail, setCustomerEmail] = useState(initialQuote?.customerEmail || '');

  // Quote Metadata
  const [date, setDate] = useState(initialQuote?.date ? initialQuote.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [validUntilDays, setValidUntilDays] = useState(initialQuote?.validUntilDays || companySettings?.defaultValidDays || 15);
  const [status, setStatus] = useState<Quote['status']>(initialQuote?.status || 'gerado');
  const [finishColor, setFinishColor] = useState<Quote['finishColor']>(initialQuote?.finishColor || 'Branco');
  const [finishColorOther, setFinishColorOther] = useState(initialQuote?.finishColorOther || '');
  const [cashDiscountPercent, setCashDiscountPercent] = useState<number>(initialQuote?.cashDiscountPercent || companySettings?.defaultCashDiscount || 10);
  const [maxInstallmentsCard, setMaxInstallmentsCard] = useState<number>(initialQuote?.maxInstallmentsCard || 12);
  const [notes, setNotes] = useState(initialQuote?.notes || '');

  // Credit Card Fee & Custom Editable Card Total State
  const [cardFeePercent, setCardFeePercent] = useState<number>(initialQuote?.cardFeePercent ?? 0);
  const [cardTotalAmount, setCardTotalAmount] = useState<number>(
    initialQuote?.cardTotalAmount ?? initialQuote?.totalAmount ?? 0
  );
  const [isManualCardTotal, setIsManualCardTotal] = useState<boolean>(
    initialQuote?.cardTotalAmount !== undefined && initialQuote?.cardTotalAmount !== initialQuote?.totalAmount
  );

  // Multiple Payment Splits State (Dinheiro, PIX, Cartão, Permuta, etc.)
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>(
    initialQuote?.paymentSplits || []
  );

  // Valor final que precisa ser 100% alocado nas formas de pagamento.
  // Por padrão acompanha o Total Geral, mas passa a ser "manual" (fixo) quando
  // o usuário aplica uma predefinição (à vista, cartão, etc.) ou edita o valor na mão,
  // pois nesse momento o valor "correto" deixa de ser o preço cheio.
  const [finalPayableAmount, setFinalPayableAmount] = useState<number>(
    initialQuote?.finalPayableAmount ?? initialQuote?.totalAmount ?? 0
  );
  const [isManualFinalPayable, setIsManualFinalPayable] = useState<boolean>(
    initialQuote?.finalPayableAmount !== undefined &&
    initialQuote?.finalPayableAmount !== initialQuote?.totalAmount
  );

  // Payment Breakdown State (Customizable Entrada & Saldo A Prazo)
  const [depositPercent, setDepositPercent] = useState<number>(initialQuote?.depositPercent ?? 50);
  const [depositAmount, setDepositAmount] = useState<number>(initialQuote?.depositAmount ?? 0);
  const [remainingAmount, setRemainingAmount] = useState<number>(initialQuote?.remainingAmount ?? 0);
  const [remainingPaymentNotes, setRemainingPaymentNotes] = useState<string>(
    initialQuote?.remainingPaymentNotes || 'Saldo restante negociado na entrega / conclusão da instalação'
  );
  const [isManualDepositAmount, setIsManualDepositAmount] = useState<boolean>(false);

  // Items State
  const [items, setItems] = useState<QuoteItem[]>(
    initialQuote?.items || [
      {
        id: 'item_1',
        quantity: 1,
        heightM: 1.000,
        widthM: 1.000,
        thicknessMm: 8,
        productName: 'Vidro Temperado Incolor',
        color: 'Incolor',
        unitPrice: 280.00,
        totalPrice: 280.00,
        pricingType: 'unit',
      },
    ]
  );

  // New Item Builder state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemHeightM, setItemHeightM] = useState<number>(1.000);
  const [itemWidthM, setItemWidthM] = useState<number>(1.000);
  const [itemThicknessMm, setItemThicknessMm] = useState<number>(8);
  const [itemProductName, setItemProductName] = useState<string>('Box de Banheiro');
  const [itemColor, setItemColor] = useState<string>('Incolor');
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(280.00);

  // When customer dropdown changes
  useEffect(() => {
    if (selectedCustomerId) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) {
        setCustomerName(found.name);
        setCustomerPhone(found.phone);
        setCustomerAddress(found.address);
        setCustomerEmail(found.email || '');
      }
    }
  }, [selectedCustomerId, customers]);

  // When category changes, auto update default price and thickness
  useEffect(() => {
    if (selectedCategoryId) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat) {
        setItemUnitPrice(cat.defaultPricePerM2 || 250);
        if (cat.defaultThicknessMm) {
          setItemThicknessMm(cat.defaultThicknessMm);
        }
      }
    }
  }, [selectedCategoryId, categories]);

  // When preset product dropdown changes
  const handleSelectProductPreset = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setItemProductName(prod.name);
      setItemUnitPrice(prod.defaultUnitPrice);
      if (prod.defaultHeightMm) setItemHeightM(prod.defaultHeightMm / 1000);
      if (prod.defaultWidthMm) setItemWidthM(prod.defaultWidthMm / 1000);
      if (prod.defaultThicknessMm) setItemThicknessMm(prod.defaultThicknessMm);
      if (prod.defaultColor) setItemColor(prod.defaultColor);
      if (prod.categoryId) setSelectedCategoryId(prod.categoryId);
    }
  };

  const handleAddItem = () => {
    if (!itemProductName.trim()) return;
    const qty = Math.max(1, itemQuantity);
    const unitP = Math.max(0, itemUnitPrice);

    // Total = Quantity * UnitPrice
    const calculatedTotal = parseFloat((qty * unitP).toFixed(2));

    const newItem: QuoteItem = {
      id: genId('item'),
      quantity: qty,
      heightM: itemHeightM,
      widthM: itemWidthM,
      thicknessMm: itemThicknessMm,
      productName: itemProductName,
      color: itemColor,
      unitPrice: unitP,
      totalPrice: calculatedTotal,
      categoryId: selectedCategoryId,
    };

    setItems([...items, newItem]);

    // Reset fields for next item
    setItemQuantity(1);
    setSelectedProductId('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const handleUpdateItemUnitPrice = (id: string, newUnitPrice: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const unitPrice = Math.max(0, newUnitPrice);
          const totalPrice = parseFloat((it.quantity * unitPrice).toFixed(2));
          return { ...it, unitPrice, totalPrice };
        }
        return it;
      })
    );
  };

  const handleUpdateItemQuantity = (id: string, newQty: number) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const quantity = Math.max(1, newQty);
          const totalPrice = parseFloat((quantity * it.unitPrice).toFixed(2));
          return { ...it, quantity, totalPrice };
        }
        return it;
      })
    );
  };

  // Calculations
  const totalAmount = parseFloat(
    items.reduce((acc, it) => acc + (it.totalPrice || 0), 0).toFixed(2)
  );

  const cashTotalAmount = parseFloat(
    (totalAmount * (1 - cashDiscountPercent / 100)).toFixed(2)
  );

  // Sync credit card total when totalAmount or cardFeePercent changes (unless manually edited)
  useEffect(() => {
    if (!isManualCardTotal) {
      const calc = parseFloat((totalAmount * (1 + (cardFeePercent || 0) / 100)).toFixed(2));
      setCardTotalAmount(calc);
    }
  }, [totalAmount, cardFeePercent, isManualCardTotal]);

  // Sync "valor final a alocar" com o Total Geral enquanto o usuário não aplicar um preset
  // com desconto/taxa nem editar manualmente. Isso garante que, no modo padrão (sem desconto),
  // o comportamento seja idêntico ao de antes (nenhuma quebra).
  useEffect(() => {
    if (!isManualFinalPayable) {
      setFinalPayableAmount(totalAmount);
    }
  }, [totalAmount, isManualFinalPayable]);

  // Tolerância para evitar falsos alertas por arredondamento de centavos (ponto flutuante)
  const ALLOCATION_EPSILON = 0.01;

  // Helper to calculate unallocated / over-allocated balance
  // IMPORTANTE: a comparação é feita contra `finalPayableAmount` (o valor que de fato
  // precisa ser recebido, já considerando desconto à vista ou taxa de cartão quando aplicável)
  // e NÃO contra o `totalAmount` bruto — essa era a causa do alerta incorreto de
  // "falta alocar" ao aplicar desconto à vista.
  const currentSplitSum = parseFloat(
    paymentSplits.reduce((acc, s) => acc + (s.amount || 0), 0).toFixed(2)
  );
  const allocationDiff = parseFloat((finalPayableAmount - currentSplitSum).toFixed(2));
  const unallocatedAmount = allocationDiff > ALLOCATION_EPSILON ? allocationDiff : 0;
  const overAllocatedAmount = allocationDiff < -ALLOCATION_EPSILON ? Math.abs(allocationDiff) : 0;
  const isFullyAllocated = Math.abs(allocationDiff) <= ALLOCATION_EPSILON;

  // Payment Split helpers
  const handleAddPaymentSplit = (method: PaymentMethodType = 'PIX', desc: string = '') => {
    const defaultVal = unallocatedAmount > 0 ? unallocatedAmount : (finalPayableAmount > 0 ? finalPayableAmount : 0);
    const newSplit: PaymentSplit = {
      id: genId('split'),
      method,
      amount: defaultVal,
      installments: method === 'Cartão de Crédito' ? (maxInstallmentsCard || 12) : 1,
      description: desc,
    };
    setPaymentSplits([...paymentSplits, newSplit]);
  };

  // Quick Preset Actions for Payment Splits
  // Cada preset agora também define explicitamente qual é o `finalPayableAmount`
  // (valor que efetivamente precisa ser 100% alocado), evitando o descompasso entre
  // "valor da(s) forma(s) de pagamento" e "valor total do orçamento" quando existe
  // desconto à vista ou taxa de cartão embutidos.
  const handleApplyPresetSplit = (presetType: 'vista' | '50_50' | 'cartao' | 'permuta') => {
    if (presetType === 'vista') {
      setPaymentSplits([
        {
          id: genId('split'),
          method: 'PIX',
          amount: cashTotalAmount,
          description: `Pagamento à vista no PIX com ${cashDiscountPercent}% de desconto`,
        },
      ]);
      setFinalPayableAmount(cashTotalAmount);
      setIsManualFinalPayable(true);
    } else if (presetType === '50_50') {
      setPaymentSplits([
        {
          id: genId('split'),
          method: 'PIX',
          amount: depositAmount,
          description: `Entrada de ${depositPercent}% no pedido`,
        },
        {
          id: genId('split'),
          method: 'Cartão de Crédito',
          amount: remainingAmount,
          installments: maxInstallmentsCard,
          description: `Saldo de ${100 - depositPercent}% na conclusão / instalação`,
        },
      ]);
      // Entrada + saldo não aplica desconto à vista nem taxa de cartão por padrão
      setFinalPayableAmount(totalAmount);
      setIsManualFinalPayable(true);
    } else if (presetType === 'cartao') {
      setPaymentSplits([
        {
          id: genId('split'),
          method: 'Cartão de Crédito',
          amount: cardTotalAmount,
          installments: maxInstallmentsCard,
          description: `Parcelado em ${maxInstallmentsCard}x no Cartão`,
        },
      ]);
      // Se houver taxa de cartão configurada, o valor final a receber é o total + taxa
      setFinalPayableAmount(cardTotalAmount);
      setIsManualFinalPayable(true);
    } else if (presetType === 'permuta') {
      const half = parseFloat((totalAmount / 2).toFixed(2));
      setPaymentSplits([
        {
          id: genId('split'),
          method: 'Permuta',
          amount: half,
          description: 'Descrever bens ou serviços oferecidos na permuta',
        },
        {
          id: genId('split'),
          method: 'PIX',
          amount: parseFloat((totalAmount - half).toFixed(2)),
          description: 'Saldo complementar',
        },
      ]);
      setFinalPayableAmount(totalAmount);
      setIsManualFinalPayable(true);
    }
  };

  // Volta o "valor final a alocar" para acompanhar automaticamente o Total Geral
  // (usado quando o usuário quer resetar após ter aplicado um preset ou editado na mão)
  const handleResetFinalPayableAmount = () => {
    setIsManualFinalPayable(false);
    setFinalPayableAmount(totalAmount);
  };

  const handleFinalPayableAmountChange = (val: number) => {
    setIsManualFinalPayable(true);
    setFinalPayableAmount(Math.max(0, val));
  };

  const handleUpdatePaymentSplit = (id: string, updated: Partial<PaymentSplit>) => {
    setPaymentSplits(
      paymentSplits.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
  };

  const handleRemovePaymentSplit = (id: string) => {
    setPaymentSplits(paymentSplits.filter((s) => s.id !== id));
  };

  // Sync deposit and remaining amounts when total or deposit percentage changes
  useEffect(() => {
    if (!isManualDepositAmount) {
      const calcDep = parseFloat(((totalAmount * depositPercent) / 100).toFixed(2));
      setDepositAmount(calcDep);
      setRemainingAmount(parseFloat(Math.max(0, totalAmount - calcDep).toFixed(2)));
    } else {
      setRemainingAmount(parseFloat(Math.max(0, totalAmount - depositAmount).toFixed(2)));
    }
  }, [totalAmount, depositPercent, isManualDepositAmount]);

  const handleSelectDepositPercent = (pct: number) => {
    setDepositPercent(pct);
    setIsManualDepositAmount(false);
    const calcDep = parseFloat(((totalAmount * pct) / 100).toFixed(2));
    setDepositAmount(calcDep);
    setRemainingAmount(parseFloat(Math.max(0, totalAmount - calcDep).toFixed(2)));
    if (pct === 100) {
      setRemainingPaymentNotes('100% Pago À Vista no pedido');
    } else if (pct === 0) {
      setRemainingPaymentNotes('100% A Prazo na entrega/conclusão da obra');
    }
  };

  const handleDepositAmountChange = (val: number) => {
    const newDep = Math.max(0, val);
    setIsManualDepositAmount(true);
    setDepositAmount(newDep);
    setRemainingAmount(parseFloat(Math.max(0, totalAmount - newDep).toFixed(2)));
    const pct = totalAmount > 0 ? parseFloat(((newDep / totalAmount) * 100).toFixed(1)) : 0;
    setDepositPercent(pct);
  };

  const handleRemainingAmountChange = (val: number) => {
    const newRem = Math.max(0, val);
    setRemainingAmount(newRem);
    const newDep = parseFloat(Math.max(0, totalAmount - newRem).toFixed(2));
    setDepositAmount(newDep);
    setIsManualDepositAmount(true);
    const pct = totalAmount > 0 ? parseFloat(((newDep / totalAmount) * 100).toFixed(1)) : 0;
    setDepositPercent(pct);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Por favor informe o nome do cliente');
      return;
    }
    if (items.length === 0) {
      alert('Adicione ao menos um item ao orçamento');
      return;
    }

    // Aviso não-bloqueante: se houver formas de pagamento cadastradas mas o valor
    // alocado não bate com o valor final a receber, confirma antes de salvar.
    if (paymentSplits.length > 0 && !isFullyAllocated) {
      const msg = unallocatedAmount > 0
        ? `Ainda falta alocar R$ ${unallocatedAmount.toFixed(2)} nas formas de pagamento. Deseja salvar mesmo assim?`
        : `As formas de pagamento somam R$ ${overAllocatedAmount.toFixed(2)} a mais que o valor final a receber. Deseja salvar mesmo assim?`;
      if (!window.confirm(msg)) {
        return;
      }
    }

    const isDepositPaid = status === 'aprovado_50' || status === 'em_andamento' || status === 'concluido';
    const isRemainingPaid = status === 'concluido';

    const newQuote: Quote = {
      id: initialQuote?.id || `quote_${Date.now()}`,
      codeNumber: initialQuote?.codeNumber || 1001, // Will be computed or kept
      tenantId,
      customerId: selectedCustomerId || `cust_manual_${Date.now()}`,
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      date: new Date(date).toISOString(),
      validUntilDays,
      status,
      items,
      totalAmount,
      cashDiscountPercent,
      cashTotalAmount,
      maxInstallmentsCard,
      cardFeePercent,
      cardTotalAmount,
      finalPayableAmount,
      paymentSplits,
      depositPaid: isDepositPaid,
      depositAmount: depositAmount,
      depositPercent: depositPercent,
      depositDate: isDepositPaid ? (initialQuote?.depositDate || new Date().toISOString()) : undefined,
      remainingPaid: isRemainingPaid,
      remainingAmount: remainingAmount,
      remainingPaymentNotes: remainingPaymentNotes,
      completionDate: isRemainingPaid ? (initialQuote?.completionDate || new Date().toISOString()) : undefined,
      finishColor,
      finishColorOther,
      notes,
      createdAt: initialQuote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    };

    await onSave(newQuote);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">
            {initialQuote ? `Editar Orçamento #${initialQuote.codeNumber}` : 'Novo Orçamento Vidraçaria'}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Especifique as medidas, produtos e acabamentos. O valor unitário pode ser ajustado na hora!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Orçamento</span>
          </button>
        </div>
      </div>

      {/* Grid: Customer Data & Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Customer Box */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Dados do Cliente
            </h3>
            <button
              type="button"
              onClick={onAddCustomerClick}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Cliente</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Select existing customer */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecionar Cliente Cadastrado
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="">-- Ou preencha manualmente abaixo --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) {c.cpfCnpj ? `- ${c.cpfCnpj}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Cliente <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Pousada Coroa Alta / Sr. João"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(73) 99999-0000"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Customer Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Rua, Número, Bairro, Cidade"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Customer Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

          </div>
        </div>

        {/* Status & Options Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            Status & Condições
          </h3>

          <div className="space-y-3">
            
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status do Pedido</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Quote['status'])}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="gerado">Orçamento Gerado</option>
                <option value="aprovado_50">Aprovado (50% Entrada Pago)</option>
                <option value="em_andamento">Em Andamento (Obra/Instalação)</option>
                <option value="concluido">Concluído (100% Pago)</option>
              </select>
            </div>

            {/* Finish color */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cor do Acabamento</label>
              <select
                value={finishColor}
                onChange={(e) => setFinishColor(e.target.value as Quote['finishColor'])}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="Branco">Branco</option>
                <option value="Preto">Preto</option>
                <option value="Fosco">Fosco</option>
                <option value="Outro">Outro (Especificar)</option>
              </select>
            </div>

            {finishColor === 'Outro' && (
              <div>
                <input
                  type="text"
                  value={finishColorOther}
                  onChange={(e) => setFinishColorOther(e.target.value)}
                  placeholder="Qual cor de acabamento?"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                />
              </div>
            )}

            {/* Date */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Validade (dias)</label>
                <input
                  type="number"
                  min="1"
                  value={validUntilDays}
                  onChange={(e) => setValidUntilDays(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-bold"
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Item Builder Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            Adicionar Itens / Sob Medida
          </h3>

          <div className="flex items-center gap-2">
            {/* Category preset selector */}
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Cat: {c.name} (R$ {c.defaultPricePerM2}/m²)
                </option>
              ))}
            </select>

            {/* Preset Product helper */}
            <select
              value={selectedProductId}
              onChange={(e) => handleSelectProductPreset(e.target.value)}
              className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="">-- Puxar produto pronto --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - R$ {p.defaultUnitPrice}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-200">
          
          {/* QT */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">QT</label>
            <input
              type="number"
              min="1"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(Number(e.target.value))}
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
            />
          </div>

          {/* ALTURA (m) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">ALTURA (m)</label>
            <input
              type="number"
              step="0.001"
              min="0.01"
              value={itemHeightM}
              onChange={(e) => setItemHeightM(Number(e.target.value))}
              placeholder="1,350"
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-mono font-bold"
            />
          </div>

          {/* LARGURA (m) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">LARGURA (m)</label>
            <input
              type="number"
              step="0.001"
              min="0.01"
              value={itemWidthM}
              onChange={(e) => setItemWidthM(Number(e.target.value))}
              placeholder="1,070"
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-mono font-bold"
            />
          </div>

          {/* ESP. (mm) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">ESP. (mm)</label>
            <input
              type="number"
              min="2"
              max="25"
              value={itemThicknessMm}
              onChange={(e) => setItemThicknessMm(Number(e.target.value))}
              placeholder="4"
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
            />
          </div>

          {/* PRODUTO */}
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">PRODUTO</label>
            <input
              type="text"
              value={itemProductName}
              onChange={(e) => setItemProductName(e.target.value)}
              placeholder="Espelho Comum / Vidro Temperado"
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            />
          </div>

          {/* COR */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">COR</label>
            <select
              value={itemColor}
              onChange={(e) => setItemColor(e.target.value)}
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
            >
              <option value="Prata">Prata</option>
              <option value="Incolor">Incolor</option>
              <option value="Fumê">Fumê</option>
              <option value="Verde">Verde</option>
              <option value="Bronze">Bronze</option>
              <option value="Jateado">Jateado</option>
            </select>
          </div>

          {/* UNIDADE (VALOR EDITÁVEL NA HORA) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1" title="Pode alterar livremente o valor do orçamento">
              UNIDADE (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={itemUnitPrice}
              onChange={(e) => setItemUnitPrice(Number(e.target.value))}
              className="w-full p-1.5 bg-white border border-blue-400 rounded-lg text-xs text-right font-mono font-bold text-blue-900"
            />
          </div>

        </div>

        {/* Add item button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Adicionar Item ao Orçamento</span>
          </button>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-2.5 text-center w-[50px]">QT</th>
                <th className="p-2.5 text-center w-[80px]">ALTURA</th>
                <th className="p-2.5 text-center w-[80px]">LARGURA</th>
                <th className="p-2.5 text-center w-[60px]">ESP.</th>
                <th className="p-2.5">PRODUTO</th>
                <th className="p-2.5 text-center w-[80px]">COR</th>
                <th className="p-2.5 text-right w-[120px]">UNIDADE (R$)</th>
                <th className="p-2.5 text-right w-[120px]">TOTAL (R$)</th>
                <th className="p-2.5 text-center w-[50px]">AÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                    Nenhum item adicionado ainda. Preencha os campos acima e clique em "Adicionar Item".
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    {/* QT Editable */}
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItemQuantity(it.id, Number(e.target.value))}
                        className="w-12 text-center p-1 border border-slate-300 rounded-md font-bold text-xs"
                      />
                    </td>
                    <td className="p-2 text-center font-mono">{it.heightM.toFixed(3).replace('.', ',')} m</td>
                    <td className="p-2 text-center font-mono">{it.widthM.toFixed(3).replace('.', ',')} m</td>
                    <td className="p-2 text-center font-bold">{it.thicknessMm}mm</td>
                    <td className="p-2 font-bold uppercase text-slate-900">{it.productName}</td>
                    <td className="p-2 text-center">{it.color}</td>

                    {/* Unit Price Editable live in table */}
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => handleUpdateItemUnitPrice(it.id, Number(e.target.value))}
                        className="w-24 text-right p-1 border border-blue-400 bg-blue-50/50 rounded-md font-mono font-bold text-xs text-blue-900"
                        title="Valor unitário editável"
                      />
                    </td>

                    {/* Total */}
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      R$ {it.totalPrice.toFixed(2)}
                    </td>

                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="Remover Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals & Financial Box */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-6 border border-slate-800">
        
        {/* Header Bar: Total General & Desconto À Vista */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Total Geral do Orçamento</span>
            <span className="text-3xl font-black font-mono text-emerald-400">R$ {totalAmount.toFixed(2)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-900/90 p-3 rounded-lg border border-slate-700/60">
            <div>
              <span className="text-[11px] font-bold text-slate-300 block mb-0.5">Desconto À Vista (%)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={cashDiscountPercent}
                  onChange={(e) => setCashDiscountPercent(Number(e.target.value))}
                  className="w-14 p-1 bg-slate-950 border border-slate-600 rounded text-center font-bold text-xs text-blue-300 focus:outline-hidden"
                />
                <span className="text-xs text-slate-400 font-bold">%</span>
              </div>
            </div>
            
            <div className="border-l border-slate-700 pl-4">
              <span className="text-[11px] text-slate-400 font-semibold block">Total À Vista (c/ Desconto)</span>
              <span className="text-lg font-black font-mono text-emerald-300">R$ {cashTotalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Valor Final a Alocar — controla contra qual valor as formas de pagamento são conferidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Valor Final a Alocar
              </span>
              <p className="text-[10px] text-slate-500 max-w-xs">
                Valor que as formas de pagamento abaixo precisam somar. Já é ajustado automaticamente ao aplicar uma predefinição (à vista, cartão, etc.).
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={finalPayableAmount}
                onChange={(e) => handleFinalPayableAmountChange(Number(e.target.value))}
                className="w-32 pl-7 pr-2 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-sm font-black font-mono text-white focus:border-blue-400 focus:outline-hidden"
              />
            </div>
            {isManualFinalPayable && (
              <button
                type="button"
                onClick={handleResetFinalPayableAmount}
                className="text-[10px] font-bold text-blue-300 hover:text-blue-200 underline underline-offset-2 cursor-pointer"
                title="Voltar a acompanhar o Total Geral automaticamente"
              >
                Redefinir p/ Total Geral
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setFinalPayableAmount(totalAmount); setIsManualFinalPayable(true); }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold rounded-md cursor-pointer"
            >
              = Total Cheio
            </button>
            <button
              type="button"
              onClick={() => { setFinalPayableAmount(cashTotalAmount); setIsManualFinalPayable(true); }}
              className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold rounded-md cursor-pointer"
            >
              = Total À Vista
            </button>
            <button
              type="button"
              onClick={() => { setFinalPayableAmount(cardTotalAmount); setIsManualFinalPayable(true); }}
              className="px-2 py-1 bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-600/50 text-[10px] font-bold rounded-md cursor-pointer"
            >
              = Total no Cartão
            </button>
          </div>
        </div>

        {/* Dynamic Payment Split Section */}
        <div className="bg-slate-800/90 p-5 rounded-xl border border-purple-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <div>
                <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                  Divisão de Pagamento & Condições Negociadas
                </h4>
                <p className="text-[11px] text-purple-300">
                  Defina de forma 100% dinâmica as formas de pagamento escolhidas pelo cliente (Dinheiro, PIX, Cartão, Boleto, etc.)
                </p>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold mr-1">Predefinições Rápida:</span>
              <button
                type="button"
                onClick={() => handleApplyPresetSplit('vista')}
                className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                title="Aplicar 100% à vista no PIX com desconto"
              >
                <span>⚡ 100% À Vista</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetSplit('50_50')}
                className="px-2.5 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-500/40 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                title="Aplicar Entrada + Saldo na instalação"
              >
                <span>🤝 Entrada + Saldo</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetSplit('cartao')}
                className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/40 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                title="Aplicar Cartão de Crédito Parcelado"
              >
                <span>💳 Cartão de Crédito</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetSplit('permuta')}
                className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                title="Aplicar Permuta + Saldo"
              >
                <span>🔄 Permuta</span>
              </button>
            </div>
          </div>

          {/* List of Payment Splits */}
          {paymentSplits.length === 0 ? (
            <div className="text-center p-6 bg-slate-950/50 rounded-xl border border-dashed border-slate-700 space-y-3">
              <p className="text-xs text-slate-300">
                Nenhuma divisão de pagamento selecionada ainda. Escolha uma predefinição acima ou monte as formas negociadas:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddPaymentSplit('PIX', 'Pagamento via PIX')}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Adicionar PIX / Dinheiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPaymentSplit('Cartão de Crédito', `${maxInstallmentsCard}x no Cartão`)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>+ Adicionar Cartão de Crédito</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPaymentSplit('Permuta', 'Descrição do bem/serviço em permuta')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                >
                  <span>🔄 + Adicionar Permuta</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentSplits.map((split, index) => (
                <div
                  key={split.id}
                  className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    {/* Method Selector */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-slate-300 font-bold mb-1">
                        Forma #{index + 1}
                      </label>
                      <select
                        value={split.method}
                        onChange={(e) => handleUpdatePaymentSplit(split.id, { method: e.target.value as PaymentMethodType })}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:border-purple-500 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Dinheiro">💵 Dinheiro</option>
                        <option value="PIX">⚡ PIX</option>
                        <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                        <option value="Cartão de Débito">💳 Cartão de Débito</option>
                        <option value="Boleto">📄 Boleto</option>
                        <option value="Cheque">🏦 Cheque</option>
                        <option value="Permuta">🔄 PERMUTA (Troca/Serviço)</option>
                        <option value="Outro">⚙️ Outro</option>
                      </select>
                    </div>

                    {/* Amount R$ */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-slate-300 font-bold mb-1">
                        Valor Destinado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.amount}
                        onChange={(e) => handleUpdatePaymentSplit(split.id, { amount: Number(e.target.value) })}
                        className="w-full p-2 bg-slate-900 border border-purple-500/50 rounded-lg text-xs font-black font-mono text-purple-300 focus:border-purple-400 focus:outline-hidden"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Description / Details */}
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-slate-300 font-bold mb-1">
                        {split.method === 'Permuta' ? 'Descrição detalhada da Permuta' : 'Observações / Detalhes'}
                      </label>
                      <input
                        type="text"
                        value={split.description || ''}
                        onChange={(e) => handleUpdatePaymentSplit(split.id, { description: e.target.value })}
                        placeholder={
                          split.method === 'Permuta'
                            ? 'Ex: Serviço de pintura predial / Troca de veículo / Vidros da obra B'
                            : 'Ex: Entrada no PIX / Saldo na instalação / Boleto 30 dias'
                        }
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-purple-500 focus:outline-hidden placeholder-slate-500"
                      />
                    </div>

                    {/* Delete button */}
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentSplit(split.id)}
                        className="p-2 text-red-400 hover:text-red-200 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Remover esta forma"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Special options inline if Cartão de Crédito */}
                  {split.method === 'Cartão de Crédito' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/80 p-2.5 rounded-lg border border-sky-500/30 text-xs mt-2">
                      <div>
                        <span className="text-[10px] font-bold text-sky-300 block mb-0.5">Nº de Parcelas</span>
                        <select
                          value={split.installments || maxInstallmentsCard || 12}
                          onChange={(e) => {
                            const inst = Number(e.target.value);
                            // Só regenera a descrição se ela ainda for o texto padrão
                            // (ex: "Parcelado em 12x no Cartão"), para não sobrescrever
                            // uma descrição que o usuário tenha digitado manualmente.
                            const isAutoDescription =
                              !split.description || /^Parcelado em \d+x no Cartão$/.test(split.description);
                            handleUpdatePaymentSplit(split.id, {
                              installments: inst,
                              ...(isAutoDescription ? { description: `Parcelado em ${inst}x no Cartão` } : {}),
                            });
                            setMaxInstallmentsCard(inst);
                          }}
                          className="w-full p-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-sky-300 focus:outline-hidden cursor-pointer"
                        >
                          <option value={1}>1x (À vista no Cartão)</option>
                          <option value={2}>2x parcelado</option>
                          <option value={3}>3x parcelado</option>
                          <option value={4}>4x parcelado</option>
                          <option value={5}>5x parcelado</option>
                          <option value={6}>6x parcelado</option>
                          <option value={8}>8x parcelado</option>
                          <option value={10}>10x parcelado</option>
                          <option value={12}>12x parcelado</option>
                          <option value={18}>18x parcelado</option>
                          <option value={24}>24x parcelado</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-sky-300 block mb-0.5">Taxa da Máquina (%)</span>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="50"
                            value={cardFeePercent}
                            onChange={(e) => {
                              const fee = Number(e.target.value);
                              setCardFeePercent(fee);
                            }}
                            className="w-full p-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-white font-mono pr-6 focus:outline-hidden"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-slate-400 block">Valor da Parcela:</span>
                        <span className="font-bold text-sky-300 font-mono text-sm">
                          {(split.installments || 1) > 1
                            ? `${split.installments}x de R$ ${(split.amount / (split.installments || 1)).toFixed(2)}`
                            : `1x de R$ ${split.amount.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Bottom bar for Divisão de Pagamento */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPaymentSplit('PIX', '')}
                    className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-500/50 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Forma</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddPaymentSplit('Permuta', 'Descrição da permuta')}
                    className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>🔄 + Permuta</span>
                  </button>
                </div>

                <div className="text-xs font-mono font-bold text-slate-300 flex flex-wrap items-center gap-3">
                  <div>
                    <span className="text-slate-400">Soma das Formas:</span>{' '}
                    <span className="text-purple-300 font-black">
                      R$ {currentSplitSum.toFixed(2)}
                    </span>
                  </div>

                  {unallocatedAmount > 0 ? (
                    <span className="text-amber-400 font-bold bg-amber-950/80 px-2.5 py-1 rounded-md border border-amber-500/40 text-[11px]">
                      ⚠️ Falta alocar: R$ {unallocatedAmount.toFixed(2)}
                    </span>
                  ) : overAllocatedAmount > 0 ? (
                    <span className="text-rose-400 font-bold bg-rose-950/80 px-2.5 py-1 rounded-md border border-rose-500/40 text-[11px]">
                      ⚠️ Valor excedido: R$ {overAllocatedAmount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-500/40 text-[11px]">
                      ✓ 100% Alocado (R$ {finalPayableAmount.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>



        {/* Observations */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Observações Internas / Garantia</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações para a equipe de instalação ou prazos da obra..."
            className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Check className="w-5 h-5" />
            <span>Finalizar e Salvar Orçamento</span>
          </button>
        </div>

      </div>

    </form>
  );
};
