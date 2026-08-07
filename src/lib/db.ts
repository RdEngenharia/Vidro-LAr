import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Customer, Category, ProductPreset, Quote, CompanySettings, SyncQueueItem } from '../types';

interface VidracariaDBSchema extends DBSchema {
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-tenant': string };
  };
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-tenant': string };
  };
  products: {
    key: string;
    value: ProductPreset;
    indexes: { 'by-tenant': string };
  };
  quotes: {
    key: string;
    value: Quote;
    indexes: { 'by-tenant': string; 'by-status': string };
  };
  settings: {
    key: string;
    value: CompanySettings;
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-tenant': string };
  };
}

const DB_NAME = 'VidracariaProDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VidracariaDBSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VidracariaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
          customerStore.createIndex('by-tenant', 'tenantId');
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('by-tenant', 'tenantId');
        }

        // Products store
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('by-tenant', 'tenantId');
        }

        // Quotes store
        if (!db.objectStoreNames.contains('quotes')) {
          const quoteStore = db.createObjectStore('quotes', { keyPath: 'id' });
          quoteStore.createIndex('by-tenant', 'tenantId');
          quoteStore.createIndex('by-status', 'status');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'tenantId' });
        }

        // Sync Queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-tenant', 'tenantId');
        }
      },
    });
  }
  return dbPromise;
}

// Default initial data for a tenant
export async function initializeTenantData(tenantId: string, companyName: string = 'Minha Vidraçaria', email: string = '') {
  const db = await getDB();
  
  // Check if categories already exist
  const existingCats = await db.getAllFromIndex('categories', 'by-tenant', tenantId);
  if (existingCats.length === 0) {
    const defaultCategories: Category[] = [
      {
        id: `cat_box_${tenantId}`,
        tenantId,
        name: 'Box',
        description: 'Box de Banheiro padrão ou sob medida com vidro temperado 8mm',
        defaultPricePerM2: 280.00,
        pricingType: 'm2',
        defaultThicknessMm: 8,
        updatedAt: new Date().toISOString(),
      },
      {
        id: `cat_janelas_${tenantId}`,
        tenantId,
        name: 'Janelas Padrão',
        description: 'Janelas em vidro temperado de medidas comerciais padrão',
        defaultPricePerM2: 240.00,
        pricingType: 'unit',
        defaultThicknessMm: 8,
        updatedAt: new Date().toISOString(),
      },
      {
        id: `cat_sobmedida_${tenantId}`,
        tenantId,
        name: 'Sob Medida',
        description: 'Espelhos, tampos, sacadas e vidros sob medida especial',
        defaultPricePerM2: 320.00,
        pricingType: 'm2',
        defaultThicknessMm: 6,
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const cat of defaultCategories) {
      await db.put('categories', cat);
    }

    // Standard Preset Products
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
        defaultUnitPrice: 650.00,
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
        defaultUnitPrice: 580.00,
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
        defaultUnitPrice: 510.00,
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
        defaultUnitPrice: 320.00,
        unit: 'm2',
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const prod of defaultProducts) {
      await db.put('products', prod);
    }
  }

  // Check Settings
  const existingSettings = await db.get('settings', tenantId);
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
    await db.put('settings', defaultSettings);
  }
}

// Customers API
export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const db = await getDB();
  return db.getAllFromIndex('customers', 'by-tenant', tenantId);
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const db = await getDB();
  await db.put('customers', customer);
  await queueSync(customer.tenantId, 'customers', 'UPDATE', customer);
}

export async function deleteCustomer(id: string, tenantId: string): Promise<void> {
  const db = await getDB();
  await db.delete('customers', id);
  await queueSync(tenantId, 'customers', 'DELETE', { id });
}

// Categories API
export async function getCategories(tenantId: string): Promise<Category[]> {
  const db = await getDB();
  return db.getAllFromIndex('categories', 'by-tenant', tenantId);
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
  await queueSync(category.tenantId, 'categories', 'UPDATE', category);
}

export async function deleteCategory(id: string, tenantId: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', id);
  await queueSync(tenantId, 'categories', 'DELETE', { id });
}

// Products API
export async function getProducts(tenantId: string): Promise<ProductPreset[]> {
  const db = await getDB();
  return db.getAllFromIndex('products', 'by-tenant', tenantId);
}

export async function saveProduct(product: ProductPreset): Promise<void> {
  const db = await getDB();
  await db.put('products', product);
  await queueSync(product.tenantId, 'products', 'UPDATE', product);
}

export async function deleteProduct(id: string, tenantId: string): Promise<void> {
  const db = await getDB();
  await db.delete('products', id);
  await queueSync(tenantId, 'products', 'DELETE', { id });
}

// Quotes API
export async function getQuotes(tenantId: string): Promise<Quote[]> {
  const db = await getDB();
  const quotes = await db.getAllFromIndex('quotes', 'by-tenant', tenantId);
  return quotes.sort((a, b) => b.codeNumber - a.codeNumber);
}

export async function getNextQuoteNumber(tenantId: string): Promise<number> {
  const quotes = await getQuotes(tenantId);
  if (quotes.length === 0) return 1001;
  const maxNum = Math.max(...quotes.map((q) => q.codeNumber || 1000));
  return maxNum + 1;
}

export async function saveQuote(quote: Quote): Promise<void> {
  const db = await getDB();
  await db.put('quotes', quote);
  await queueSync(quote.tenantId, 'quotes', 'UPDATE', quote);
}

export async function deleteQuote(id: string, tenantId: string): Promise<void> {
  const db = await getDB();
  await db.delete('quotes', id);
  await queueSync(tenantId, 'quotes', 'DELETE', { id });
}

// Settings API
export async function getCompanySettings(tenantId: string): Promise<CompanySettings | undefined> {
  const db = await getDB();
  return db.get('settings', tenantId);
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
  await queueSync(settings.tenantId, 'settings', 'UPDATE', settings);
}

// Sync Queue API
export async function queueSync(
  tenantId: string,
  collection: SyncQueueItem['collection'],
  action: SyncQueueItem['action'],
  data: any
) {
  const db = await getDB();
  const syncItem: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    tenantId,
    collection,
    action,
    data,
    timestamp: Date.now(),
  };
  await db.put('syncQueue', syncItem);
}

export async function getSyncQueue(tenantId: string): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-tenant', tenantId);
}

export async function clearSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}
