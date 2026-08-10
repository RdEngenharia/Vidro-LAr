import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { Customer, Category, ProductPreset, Quote, CompanySettings } from './types';
import {
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getCategories,
  saveCategory,
  deleteCategory,
  getProducts,
  saveProduct,
  deleteProduct,
  getQuotes,
  getNextQuoteNumber,
  saveQuote,
  deleteQuote,
  getCompanySettings,
} from './lib/db';

import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { QuoteList } from './components/QuoteList';
import { QuoteForm } from './components/QuoteForm';
import { QuotePDFView } from './components/QuotePDFView';
import { CustomerManager } from './components/CustomerManager';
import { CategoryProductManager } from './components/CategoryProductManager';
import { CompanySettingsView } from './components/CompanySettings';
import { EmitirBoletos } from './components/EmitirBoletos';
import { LoginModal } from './components/LoginModal';
import { DeployGuideModal } from './components/DeployGuideModal';
import { DevConsoleModal } from './components/DevConsoleModal';
import { setLoggerContext } from './lib/logger';

function MainApp() {
  const { user, settings, updateSettings, loading } = useAuth();
  const tenantId = user?.tenantId || 'tenant_default';

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [quoteSubView, setQuoteSubView] = useState<'list' | 'form' | 'pdf'>('list');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // App Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductPreset[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);
  const [isDevConsoleOpen, setIsDevConsoleOpen] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Pré-preenchimento ao clicar em "Emitir Boleto" de dentro de um orçamento específico
  const [boletoPrefill, setBoletoPrefill] = useState<{ customerId: string; quoteId: string } | null>(null);

  // Update Logger context whenever user/tenant changes
  useEffect(() => {
    if (tenantId) {
      setLoggerContext(tenantId, user?.email);
    }
  }, [tenantId, user]);

  // Carrega os dados do tenant DIRETO do Firestore (única fonte de verdade).
  const loadTenantData = async () => {
    if (!tenantId) return;
    try {
      const [custData, catData, prodData, quoteData] = await Promise.all([
        getCustomers(tenantId),
        getCategories(tenantId),
        getProducts(tenantId),
        getQuotes(tenantId),
      ]);

      setCustomers(custData);
      setCategories(catData);
      setProducts(prodData);
      setQuotes(quoteData);
    } catch (e) {
      console.error('Error loading tenant data from Firestore', e);
    }
  };

  useEffect(() => {
    if (user) {
      loadTenantData();
    }
  }, [user]);

  // Busca os dados mais recentes do Firestore e atualiza a tela. Útil quando o
  // mesmo usuário criou/editou orçamentos em outro navegador/aparelho e quer
  // vê-los aqui também sem precisar sair e entrar de novo.
  const handleCloudSync = async () => {
    if (!tenantId || isCloudSyncing) return;
    setIsCloudSyncing(true);
    try {
      await loadTenantData();
    } catch (e) {
      console.error('Error refreshing data from Firestore', e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Handlers for Quotes
  const handleNewQuoteClick = () => {
    setSelectedQuote(null);
    setActiveTab('quotes');
    setQuoteSubView('form');
  };

  const handleSaveQuote = async (quoteToSave: Quote) => {
    // If new quote, assign next code number
    if (!selectedQuote) {
      const nextNum = await getNextQuoteNumber(tenantId);
      quoteToSave.codeNumber = nextNum;
    }
    await saveQuote(quoteToSave);
    await loadTenantData();
    setSelectedQuote(quoteToSave);
    setQuoteSubView('pdf'); // Direct view PDF after save
  };

  const handleUpdateQuoteStatus = async (quoteId: string, newStatus: Quote['status']) => {
    const existing = quotes.find((q) => q.id === quoteId);
    if (existing) {
      // Uma Divisão de Pagamento com UMA ÚNICA forma (ex: 100% à vista no PIX, 100%
      // no cartão, permuta única) significa que o pagamento é feito de uma vez só —
      // não existe "entrada" separada de "saldo". O mesmo vale para orçamentos antigos
      // que usam o campo legado depositPercent = 100. Nesses casos, confirmar o
      // recebimento quita entrada E saldo juntos, no mesmo clique.
      const isSinglePaymentSplit = !!(existing.paymentSplits && existing.paymentSplits.length === 1);
      const isFullCashLegacy = !existing.paymentSplits?.length && existing.depositPercent === 100;
      const isFullUpfrontPayment = isSinglePaymentSplit || isFullCashLegacy;

      const isDepositPaid = newStatus !== 'gerado';
      const isRemainingPaid = newStatus === 'concluido' || (isDepositPaid && isFullUpfrontPayment);

      const updated: Quote = {
        ...existing,
        status: newStatus,
        depositPaid: isDepositPaid,
        depositDate: isDepositPaid ? (existing.depositDate || new Date().toISOString()) : undefined,
        remainingPaid: isRemainingPaid,
        remainingAmount: isFullUpfrontPayment && isDepositPaid ? 0 : existing.remainingAmount,
        completionDate: isRemainingPaid ? (existing.completionDate || new Date().toISOString()) : undefined,
        updatedAt: new Date().toISOString(),
      };
      await saveQuote(updated);
      await loadTenantData();
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote(updated);
      }
    }
  };

  const handleDeleteQuote = async (id: string) => {
    await deleteQuote(id, tenantId);
    await loadTenantData();
    if (selectedQuote?.id === id) {
      setQuoteSubView('list');
      setSelectedQuote(null);
    }
  };

  // Handlers for Customers
  const handleSaveCustomer = async (cust: Customer) => {
    await saveCustomer(cust);
    await loadTenantData();
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteCustomer(id, tenantId);
    await loadTenantData();
  };

  // Handlers for Categories
  const handleSaveCategory = async (cat: Category) => {
    await saveCategory(cat);
    await loadTenantData();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id, tenantId);
    await loadTenantData();
  };

  // Handlers for Products
  const handleSaveProduct = async (prod: ProductPreset) => {
    await saveProduct(prod);
    await loadTenantData();
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id, tenantId);
    await loadTenantData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 text-slate-900 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold">Carregando Sistema Vidraçaria Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Login Modal overlay if no user */}
      <LoginModal
        isOpen={!user}
      />

      {/* Deploy Guide Modal */}
      <DeployGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />

      {/* Developer Console Modal */}
      <DevConsoleModal
        isOpen={isDevConsoleOpen}
        onClose={() => setIsDevConsoleOpen(false)}
        currentTenantId={tenantId}
        currentUserEmail={user?.email}
        companySettings={settings}
        onUpdateSettings={updateSettings}
      />

      {user && (
        <>
          {/* Top Navbar */}
          <Navbar
            onNewQuoteClick={handleNewQuoteClick}
            onDeployGuideClick={() => setIsDeployGuideOpen(true)}
            onDevConsoleClick={() => setIsDevConsoleOpen(true)}
            onCloudSyncClick={handleCloudSync}
            isCloudSyncing={isCloudSyncing}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {/* Main Layout */}
          <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
            
            {/* Sidebar */}
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                if (tab === 'quotes') setQuoteSubView('list');
                if (tab === 'deploy') setIsDeployGuideOpen(true);
              }}
              quotesCount={quotes.length}
              customersCount={customers.length}
              categoriesCount={categories.length}
            />

            {/* Content Area */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
              
              {/* QUOTES TAB */}
              {activeTab === 'quotes' && (
                <>
                  {quoteSubView === 'list' && (
                    <QuoteList
                      quotes={quotes}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onNewQuote={handleNewQuoteClick}
                      onViewPDF={(q) => {
                        setSelectedQuote(q);
                        setQuoteSubView('pdf');
                      }}
                      onEdit={(q) => {
                        setSelectedQuote(q);
                        setQuoteSubView('form');
                      }}
                      onDelete={handleDeleteQuote}
                      onUpdateStatus={handleUpdateQuoteStatus}
                    />
                  )}

                  {quoteSubView === 'form' && (
                    <QuoteForm
                      initialQuote={selectedQuote}
                      customers={customers}
                      categories={categories}
                      products={products}
                      companySettings={settings}
                      onSave={handleSaveQuote}
                      onCancel={() => setQuoteSubView('list')}
                      onAddCustomerClick={() => setActiveTab('customers')}
                    />
                  )}

                  {quoteSubView === 'pdf' && selectedQuote && (
                    <QuotePDFView
                      quote={selectedQuote}
                      companySettings={settings || undefined}
                      onBack={() => setQuoteSubView('list')}
                      onUpdateStatus={(newStatus) => handleUpdateQuoteStatus(selectedQuote.id, newStatus)}
                      onEmitBoleto={() => {
                        setBoletoPrefill({ customerId: selectedQuote.customerId, quoteId: selectedQuote.id });
                        setActiveTab('boletos');
                      }}
                    />
                  )}
                </>
              )}

              {/* CUSTOMERS TAB */}
              {activeTab === 'customers' && (
                <CustomerManager
                  customers={customers}
                  onSaveCustomer={handleSaveCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                />
              )}

              {/* CATEGORIES & PRODUCTS TAB */}
              {activeTab === 'categories' && (
                <CategoryProductManager
                  categories={categories}
                  products={products}
                  onSaveCategory={handleSaveCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {/* BOLETOS TAB */}
              {activeTab === 'boletos' && (
                <EmitirBoletos
                  tenantId={tenantId}
                  customers={customers}
                  quotes={quotes}
                  prefill={boletoPrefill}
                  onClearPrefill={() => setBoletoPrefill(null)}
                />
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <CompanySettingsView
                  settings={settings}
                  onSave={async (newSettings) => {
                    await updateSettings(newSettings);
                  }}
                />
              )}

            </main>

          </div>
        </>
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
