// ---------------------------------------------------------------------------
// Camada de dados do app — Firestore como ÚNICA fonte de verdade.
// ---------------------------------------------------------------------------
// Antes, este arquivo mantinha um banco IndexedDB próprio + uma fila de
// sincronização manual para enviar/buscar dados do Firestore. Essa duplicação
// era a origem de vários bugs (orçamentos que não apareciam em outro
// dispositivo, exclusões que "voltavam", etc.).
//
// Agora, toda leitura e escrita vai direto para o Firestore. O suporte a uso
// offline continua existindo, mas é feito pelo cache local PERSISTENTE nativo
// do próprio SDK do Firestore (configurado em firebase.ts com
// `persistentLocalCache`) — ele guarda os dados em IndexedDB por baixo dos
// panos, serve leituras do cache quando offline, enfileira escritas feitas
// offline automaticamente, e sincroniza sozinho assim que a conexão volta.
// Não precisamos mais reimplementar nada disso manualmente.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db as firebaseDb, ensureFirebaseAuth } from './firebase';
import { Customer, Category, ProductPreset, Quote, CompanySettings } from '../types';

function requireDb() {
  if (!firebaseDb) {
    throw new Error('Firestore não inicializado. Verifique a configuração do Firebase (.env).');
  }
  return firebaseDb;
}

function tenantCollection(tenantId: string, name: string) {
  return collection(requireDb(), 'tenants', tenantId, name);
}

function tenantDoc(tenantId: string, name: string, id: string) {
  return doc(requireDb(), 'tenants', tenantId, name, id);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export async function getCustomers(tenantId: string): Promise<Customer[]> {
  await ensureFirebaseAuth();
  const snap = await getDocs(tenantCollection(tenantId, 'customers'));
  return snap.docs.map((d) => d.data() as Customer);
}

export async function saveCustomer(customer: Customer): Promise<void> {
  await ensureFirebaseAuth();
  await setDoc(tenantDoc(customer.tenantId, 'customers', customer.id), customer, { merge: true });
}

export async function deleteCustomer(id: string, tenantId: string): Promise<void> {
  await ensureFirebaseAuth();
  await deleteDoc(tenantDoc(tenantId, 'customers', id));
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export async function getCategories(tenantId: string): Promise<Category[]> {
  await ensureFirebaseAuth();
  const snap = await getDocs(tenantCollection(tenantId, 'categories'));
  return snap.docs.map((d) => d.data() as Category);
}

export async function saveCategory(category: Category): Promise<void> {
  await ensureFirebaseAuth();
  await setDoc(tenantDoc(category.tenantId, 'categories', category.id), category, { merge: true });
}

export async function deleteCategory(id: string, tenantId: string): Promise<void> {
  await ensureFirebaseAuth();
  await deleteDoc(tenantDoc(tenantId, 'categories', id));
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------
export async function getProducts(tenantId: string): Promise<ProductPreset[]> {
  await ensureFirebaseAuth();
  const snap = await getDocs(tenantCollection(tenantId, 'products'));
  return snap.docs.map((d) => d.data() as ProductPreset);
}

export async function saveProduct(product: ProductPreset): Promise<void> {
  await ensureFirebaseAuth();
  await setDoc(tenantDoc(product.tenantId, 'products', product.id), product, { merge: true });
}

export async function deleteProduct(id: string, tenantId: string): Promise<void> {
  await ensureFirebaseAuth();
  await deleteDoc(tenantDoc(tenantId, 'products', id));
}

// ---------------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------------
export async function getQuotes(tenantId: string): Promise<Quote[]> {
  await ensureFirebaseAuth();
  const snap = await getDocs(tenantCollection(tenantId, 'quotes'));
  const quotes = snap.docs.map((d) => d.data() as Quote);
  return quotes.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));
}

export async function getNextQuoteNumber(tenantId: string): Promise<number> {
  const quotes = await getQuotes(tenantId);
  if (quotes.length === 0) return 1001;
  const maxNum = Math.max(...quotes.map((q) => q.codeNumber || 1000));
  return maxNum + 1;
}

export async function saveQuote(quote: Quote): Promise<void> {
  await ensureFirebaseAuth();
  await setDoc(tenantDoc(quote.tenantId, 'quotes', quote.id), quote, { merge: true });
}

export async function deleteQuote(id: string, tenantId: string): Promise<void> {
  await ensureFirebaseAuth();
  await deleteDoc(tenantDoc(tenantId, 'quotes', id));
}

// ---------------------------------------------------------------------------
// Configurações da Empresa (documento único por tenant)
// ---------------------------------------------------------------------------
export async function getCompanySettings(tenantId: string): Promise<CompanySettings | undefined> {
  await ensureFirebaseAuth();
  const snap = await getDoc(tenantDoc(tenantId, 'settings', tenantId));
  return snap.exists() ? (snap.data() as CompanySettings) : undefined;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  await ensureFirebaseAuth();
  await setDoc(tenantDoc(settings.tenantId, 'settings', settings.tenantId), settings, { merge: true });
}

// ---------------------------------------------------------------------------
// Inicialização de um novo tenant (primeira vez que a conta é usada)
// ---------------------------------------------------------------------------
export async function initializeTenantData(
  tenantId: string,
  companyName: string = 'Minha Vidraçaria',
  email: string = ''
) {
  await ensureFirebaseAuth();

  // Categorias/produtos padrão só são semeados se ainda não existir nada — evita
  // sobrescrever dados reais de um tenant que já tem categorias próprias cadastradas.
  const existingCats = await getCategories(tenantId);
  if (existingCats.length === 0) {
    const defaultCategories: Category[] = [
      {
        id: `cat_box_${tenantId}`,
        tenantId,
        name: 'Box',
        description: 'Box de Banheiro padrão ou sob medida com vidro temperado 8mm',
        defaultPricePerM2: 280.0,
        pricingType: 'm2',
        defaultThicknessMm: 8,
        updatedAt: new Date().toISOString(),
      },
      {
        id: `cat_janelas_${tenantId}`,
        tenantId,
        name: 'Janelas Padrão',
        description: 'Janelas em vidro temperado de medidas comerciais padrão',
        defaultPricePerM2: 240.0,
        pricingType: 'unit',
        defaultThicknessMm: 8,
        updatedAt: new Date().toISOString(),
      },
      {
        id: `cat_sobmedida_${tenantId}`,
        tenantId,
        name: 'Sob Medida',
        description: 'Espelhos, tampos, sacadas e vidros sob medida especial',
        defaultPricePerM2: 320.0,
        pricingType: 'm2',
        defaultThicknessMm: 6,
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const cat of defaultCategories) {
      await saveCategory(cat);
    }

    const defaultProducts: ProductPreset[] = [
      {
        id: `prod_1_${tenantId}`,
        tenantId,
        categoryId: defaultCategories[0].id,
        name: 'Box Frontal 2 Folhas (1 Fixo + 1 Móvel)',
        defaultHeightMm: 1900,
        defaultWidthMm: 1200,
        defaultThicknessMm: 8,
        defaultColor: 'Incolor',
        defaultUnitPrice: 650.0,
        unit: 'un',
        updatedAt: new Date().toISOString(),
      },
      {
        id: `prod_2_${tenantId}`,
        tenantId,
        categoryId: defaultCategories[1].id,
        name: 'Janela 4 Folhas 1,00x1,20m',
        defaultHeightMm: 1000,
        defaultWidthMm: 1200,
        defaultThicknessMm: 8,
        defaultColor: 'Incolor',
        defaultUnitPrice: 580.0,
        unit: 'un',
        updatedAt: new Date().toISOString(),
      },
      {
        id: `prod_3_${tenantId}`,
        tenantId,
        categoryId: defaultCategories[2].id,
        name: 'Espelho Comum Lapidado 4mm',
        defaultHeightMm: 1350,
        defaultWidthMm: 1070,
        defaultThicknessMm: 4,
        defaultColor: 'Prata',
        defaultUnitPrice: 510.0,
        unit: 'm2',
        updatedAt: new Date().toISOString(),
      },
      {
        id: `prod_4_${tenantId}`,
        tenantId,
        categoryId: defaultCategories[2].id,
        name: 'Vidro Temperado 8mm Incolor',
        defaultHeightMm: 1500,
        defaultWidthMm: 1000,
        defaultThicknessMm: 8,
        defaultColor: 'Incolor',
        defaultUnitPrice: 320.0,
        unit: 'm2',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const prod of defaultProducts) {
      await saveProduct(prod);
    }
  }

  const existingSettings = await getCompanySettings(tenantId);
  if (!existingSettings) {
    const defaultSettings: CompanySettings = {
      tenantId,
      companyName,
      tradeName: companyName,
      address: '',
      cityState: '',
      phone: '',
      email,
      tagline: 'PORTAS - JANELAS - ESPELHOS - BOX & VIDROS',
      defaultCashDiscount: 10,
      defaultValidDays: 15,
      termsText: 'Proposta válida por 15 dias, ou até reajuste anunciado pelas tempêras.',
    };
    await saveCompanySettings(defaultSettings);
  }
}
