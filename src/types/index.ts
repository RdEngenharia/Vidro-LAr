export type QuoteStatus =
  | 'gerado'
  | 'aprovado_50'
  | 'aguardando_material'
  | 'pronto_instalacao'
  | 'concluido'
  | 'em_andamento';

export interface Category {
  id: string;
  tenantId: string;
  name: string; // e.g. "Box", "Janelas Padrão", "Sob Medida"
  description?: string;
  defaultPricePerM2: number; // Default price per m² or unit
  pricingType: 'm2' | 'unit'; // Pricing calculated by area (Height x Width) or fixed unit
  defaultThicknessMm?: number; // Default glass thickness (e.g. 8mm, 10mm)
  updatedAt: string;
}

export interface ProductPreset {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string; // e.g., "Porta Padrão 2 Folhas", "Janela Padrão 4 Folhas", "Box Frontal 2 Folhas", "Espelho Comum"
  defaultHeightMm?: number;
  defaultWidthMm?: number;
  defaultThicknessMm?: number;
  defaultColor?: string;
  defaultUnitPrice: number;
  unit: 'un' | 'm2';
  updatedAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  cpfCnpj?: string;
  phone: string;
  email?: string;
  address: string;
  cityState?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  quantity: number;
  heightM: number; // Altura em metros (ex: 1.350)
  widthM: number;  // Largura em metros (ex: 1.070)
  thicknessMm: number; // Espessura em mm (ex: 4, 6, 8, 10)
  productName: string; // ex: "Espelho Comum", "Vidro Temperado Incolor"
  color: string; // ex: "Prata", "Incolor", "Fumê", "Verde", "Bronze"
  unitPrice: number; // Valor Unitário (editável na hora)
  totalPrice: number; // (Quantidade * UnitPrice) ou (Quantidade * Area * UnitPrice)
  categoryId?: string;
  pricingType?: 'm2' | 'unit';
}

export interface Quote {
  id: string;
  codeNumber: number; // e.g. #1001
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail?: string;
  date: string; // ISO String
  validUntilDays: number; // e.g. 15 days
  status: QuoteStatus;
  items: QuoteItem[];
  
  // Financial breakdown
  totalAmount: number; // Valor Total
  cashDiscountPercent: number; // e.g. 10% or 15% for cash
  cashTotalAmount: number; // Valor à vista com desconto
  maxInstallmentsCard: number; // e.g. 12x
  
  // Payment tracking (50% deposit & remaining)
  depositPaid: boolean;
  depositAmount: number; // Typically 50% of total
  depositDate?: string;
  
  remainingPaid: boolean;
  remainingAmount: number; // Remaining 50%
  completionDate?: string;
  
  // Finish options (Cor do acabamento)
  finishColor: 'Preto' | 'Branco' | 'Fosco' | 'Outro';
  finishColorOther?: string;
  
  notes?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface CompanySettings {
  tenantId: string;
  companyName: string;
  tradeName: string;
  cnpj?: string;
  address: string;
  cityState: string;
  phone: string;
  email: string;
  logoUrl?: string; // Data URL or path (e.g. /logo-vidracaria.png)
  tagline: string; // e.g. "PORTAS - JANELAS - ESPELHOS - BOX & VIDROS"
  defaultCashDiscount: number; // e.g. 10%
  defaultValidDays: number; // e.g. 15
  termsText: string;
}

export interface UserProfile {
  uid: string;
  tenantId: string;
  email: string;
  name: string;
  companyName: string;
  isOfflineMode?: boolean;
}

export interface SyncQueueItem {
  id: string;
  tenantId: string;
  collection: 'customers' | 'categories' | 'products' | 'quotes' | 'settings';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
}
