import React, { useState } from 'react';
import { Category, ProductPreset } from '../types';
import { useAuth } from '../lib/authContext';
import { genId } from '../lib/id';
import { Grid, Plus, Edit, Trash2, Package, Layers, Check, Info, DollarSign } from 'lucide-react';

interface CategoryProductManagerProps {
  categories: Category[];
  products: ProductPreset[];
  onSaveCategory: (cat: Category) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onSaveProduct: (prod: ProductPreset) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

export const CategoryProductManager: React.FC<CategoryProductManagerProps> = ({
  categories,
  products,
  onSaveCategory,
  onDeleteCategory,
  onSaveProduct,
  onDeleteProduct,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || 'tenant_default';

  const [activeTab, setActiveTab] = useState<'categories' | 'products'>('categories');

  // Category Form State
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPrice, setCatPrice] = useState<number>(250);
  const [catPricingType, setCatPricingType] = useState<'m2' | 'unit'>('m2');
  const [catThickness, setCatThickness] = useState<number>(8);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // Product Form State
  const [editingProd, setEditingProd] = useState<ProductPreset | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCatId, setProdCatId] = useState(categories[0]?.id || '');
  const [prodHeightMm, setProdHeightMm] = useState<number>(1000);
  const [prodWidthMm, setProdWidthMm] = useState<number>(1200);
  const [prodThicknessMm, setProdThicknessMm] = useState<number>(8);
  const [prodColor, setProdColor] = useState('Incolor');
  const [prodUnitPrice, setProdUnitPrice] = useState<number>(450);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);

  // Category Handlers
  const openCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatDesc(cat.description || '');
      setCatPrice(cat.defaultPricePerM2);
      setCatPricingType(cat.pricingType);
      setCatThickness(cat.defaultThicknessMm || 8);
    } else {
      setEditingCat(null);
      setCatName('');
      setCatDesc('');
      setCatPrice(250);
      setCatPricingType('m2');
      setCatThickness(8);
    }
    setIsCatModalOpen(true);
  };

  const handleSaveCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const catData: Category = {
      id: editingCat?.id || genId('cat'),
      tenantId,
      name: catName,
      description: catDesc,
      defaultPricePerM2: catPrice,
      pricingType: catPricingType,
      defaultThicknessMm: catThickness,
      updatedAt: new Date().toISOString(),
    };

    await onSaveCategory(catData);
    setIsCatModalOpen(false);
  };

  // Product Handlers
  const openProdModal = (prod?: ProductPreset) => {
    if (prod) {
      setEditingProd(prod);
      setProdName(prod.name);
      setProdCatId(prod.categoryId);
      setProdHeightMm(prod.defaultHeightMm || 1000);
      setProdWidthMm(prod.defaultWidthMm || 1200);
      setProdThicknessMm(prod.defaultThicknessMm || 8);
      setProdColor(prod.defaultColor || 'Incolor');
      setProdUnitPrice(prod.defaultUnitPrice);
    } else {
      setEditingProd(null);
      setProdName('');
      setProdCatId(categories[0]?.id || '');
      setProdHeightMm(1000);
      setProdWidthMm(1200);
      setProdThicknessMm(8);
      setProdColor('Incolor');
      setProdUnitPrice(450);
    }
    setIsProdModalOpen(true);
  };

  const handleSaveProdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    const prodData: ProductPreset = {
      id: editingProd?.id || genId('prod'),
      tenantId,
      categoryId: prodCatId,
      name: prodName,
      defaultHeightMm: prodHeightMm,
      defaultWidthMm: prodWidthMm,
      defaultThicknessMm: prodThicknessMm,
      defaultColor: prodColor,
      defaultUnitPrice: prodUnitPrice,
      unit: 'un',
      updatedAt: new Date().toISOString(),
    };

    await onSaveProduct(prodData);
    setIsProdModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Grid className="w-5 h-5 text-blue-600" />
            Categorias & Preços da Vidraçaria
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure valores padrão por categoria (Box, Janelas Padrão, Sob Medida). Todos os valores são editáveis na hora do orçamento!
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Categorias ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Produtos Prontos ({products.length})
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-900 leading-relaxed">
          <strong>Flexibilidade Total de Preços:</strong> Definir um preço base aqui economiza tempo preenchendo novos orçamentos. Porém, você pode alterar livremente o valor unitário de qualquer item durante o atendimento ao cliente!
        </p>
      </div>

      {/* Categories View */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Categorias Cadastradas</h3>
            <button
              onClick={() => openCatModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Nova Categoria</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-slate-100 text-slate-800 border border-slate-200">
                      {cat.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      Espespura: {cat.defaultThicknessMm || 8}mm
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {cat.description || 'Categoria de vidro/alumínio para orçamentos.'}
                  </p>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Preço Padrão Configurado</p>
                    <p className="text-xl font-black font-mono text-blue-900 mt-0.5">
                      R$ {cat.defaultPricePerM2.toFixed(2)} <span className="text-xs font-semibold text-slate-500">/ {cat.pricingType === 'm2' ? 'm²' : 'unid'}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openCatModal(cat)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar Preço</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir categoria ${cat.name}?`)) {
                        onDeleteCategory(cat.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products View */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Produtos Pré-configurados (Catálogo)</h3>
            <button
              onClick={() => openProdModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Novo Produto Pronto</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="p-3">NOME DO PRODUTO</th>
                  <th className="p-3 text-center">CATEGORIA</th>
                  <th className="p-3 text-center">MEDIDAS PADRÃO (A x L)</th>
                  <th className="p-3 text-center">ESPESSURA</th>
                  <th className="p-3 text-center">COR</th>
                  <th className="p-3 text-right">VALOR PADRÃO</th>
                  <th className="p-3 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {products.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{p.name}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {cat?.name || 'Geral'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        {p.defaultHeightMm ? `${(p.defaultHeightMm / 1000).toFixed(3)}m × ${(p.defaultWidthMm! / 1000).toFixed(3)}m` : 'Sob Medida'}
                      </td>
                      <td className="p-3 text-center font-mono">{p.defaultThicknessMm}mm</td>
                      <td className="p-3 text-center">{p.defaultColor}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-900">
                        R$ {p.defaultUnitPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openProdModal(p)}
                            className="p-1 text-slate-600 hover:text-slate-900 rounded"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Excluir produto ${p.name}?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">
              {editingCat ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            <form onSubmit={handleSaveCatSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Ex: Box, Janelas Padrão, Sob Medida"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Ex: Vidro temperado 8mm para banheiro"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preço Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={catPrice}
                    onChange={(e) => setCatPrice(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Espessura (mm)</label>
                  <input
                    type="number"
                    value={catThickness}
                    onChange={(e) => setCatThickness(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg shadow-xs"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Preset Modal */}
      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">
              {editingProd ? 'Editar Produto Pronto' : 'Novo Produto Pronto'}
            </h3>

            <form onSubmit={handleSaveProdSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Ex: Porta Padrão 2 Folhas 2,10x1,40m"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={prodCatId}
                  onChange={(e) => setProdCatId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Altura (mm)</label>
                  <input
                    type="number"
                    value={prodHeightMm}
                    onChange={(e) => setProdHeightMm(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    value={prodWidthMm}
                    onChange={(e) => setProdWidthMm(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Espessura (mm)</label>
                  <input
                    type="number"
                    value={prodThicknessMm}
                    onChange={(e) => setProdThicknessMm(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cor do Vidro</label>
                  <input
                    type="text"
                    value={prodColor}
                    onChange={(e) => setProdColor(e.target.value)}
                    placeholder="Incolor / Prata / Fumê"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor Unitário Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodUnitPrice}
                    onChange={(e) => setProdUnitPrice(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProdModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg shadow-xs"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
