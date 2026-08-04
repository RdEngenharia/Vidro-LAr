import React, { useState, useEffect } from 'react';
import { Quote, QuoteItem, Customer, Category, ProductPreset, CompanySettings } from '../types';
import { useAuth } from '../lib/authContext';
import { Plus, Trash2, Save, UserPlus, Calculator, Info, Check, AlertCircle } from 'lucide-react';

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
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

  const deposit50Amount = parseFloat((totalAmount / 2).toFixed(2));

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
      depositPaid: isDepositPaid,
      depositAmount: deposit50Amount,
      depositDate: isDepositPaid ? (initialQuote?.depositDate || new Date().toISOString()) : undefined,
      remainingPaid: isRemainingPaid,
      remainingAmount: deposit50Amount,
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
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-blue-400 uppercase tracking-wider">
          Resumo Financeiro & Forma de Pagamento
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Total Cartão & Parcelamento */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Total no Cartão</span>
              <div className="flex items-center gap-1">
                <span>Max Parcelas:</span>
                <select
                  value={maxInstallmentsCard}
                  onChange={(e) => setMaxInstallmentsCard(Number(e.target.value))}
                  className="p-1 bg-slate-900 border border-slate-600 rounded text-xs font-bold text-blue-300 focus:outline-hidden cursor-pointer"
                >
                  <option value={1}>1x (À Vista)</option>
                  <option value={2}>Até 2x</option>
                  <option value={3}>Até 3x</option>
                  <option value={4}>Até 4x</option>
                  <option value={5}>Até 5x</option>
                  <option value={6}>Até 6x</option>
                  <option value={8}>Até 8x</option>
                  <option value={10}>Até 10x</option>
                  <option value={12}>Até 12x</option>
                  <option value={18}>Até 18x</option>
                  <option value={24}>Até 24x</option>
                </select>
              </div>
            </div>
            <p className="text-2xl font-black font-mono mt-1 text-white">
              R$ {totalAmount.toFixed(2)}
            </p>
            <p className="text-[11px] text-blue-300 mt-1 font-mono font-bold">
              {maxInstallmentsCard > 1 ? `${maxInstallmentsCard}x de R$ ${(totalAmount / maxInstallmentsCard).toFixed(2)}` : 'À vista no cartão'}
            </p>
          </div>

          {/* Total À Vista */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>A Vista (Desconto)</span>
              <div className="flex items-center gap-1">
                <span>% Desconto:</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={cashDiscountPercent}
                  onChange={(e) => setCashDiscountPercent(Number(e.target.value))}
                  className="w-12 p-0.5 bg-slate-900 border border-slate-600 rounded text-center font-bold text-xs text-blue-300"
                />
              </div>
            </div>
            <p className="text-2xl font-black font-mono mt-1 text-emerald-400">
              R$ {cashTotalAmount.toFixed(2)}
            </p>
          </div>

          {/* 50% Deposit Rule */}
          <div className="bg-slate-800 p-4 rounded-xl border border-blue-900/50">
            <p className="text-xs font-semibold text-blue-300 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Regra Vidraçaria (50% Entrada)</span>
            </p>
            <div className="mt-2 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Entrada (50%):</span>
                <span className="font-bold text-white">R$ {deposit50Amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Saldo Obra (50%):</span>
                <span className="font-bold text-amber-300">R$ {deposit50Amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

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
