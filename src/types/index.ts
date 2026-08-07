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

export type PaymentMethodType = 
  | 'Dinheiro' 
  | 'PIX' 
  | 'Cartão de Crédito' 
  | 'Cartão de Débito' 
  | 'Boleto' 
  | 'Cheque' 
  | 'Permuta' 
  | 'Outro';

export interface PaymentSplit {
  id: string;
  method: PaymentMethodType;
  amount: number;
  installments?: number;
  description?: string;
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
  totalAmount: number; // Valor Total (preço cheio, soma dos itens, sem desconto/taxa)
  cashDiscountPercent: number; // e.g. 10% or 15% for cash
  cashTotalAmount: number; // Valor à vista com desconto
  maxInstallmentsCard: number; // e.g. 12x
  cardFeePercent?: number; // Taxa da máquina de cartão (ex: 5%, 8%, 10%)
  cardTotalAmount?: number; // Valor total customizado do cartão

  // Valor final que efetivamente deve ser alocado nas formas de pagamento
  // (pode ser = totalAmount, = cashTotalAmount se à vista, = cardTotalAmount se cartão,
  // ou um valor customizado quando a negociação foge dos presets padrão)
  finalPayableAmount?: number;

  // Multiple payment methods (Dinheiro + Cartão + Permuta, etc.)
  paymentSplits?: PaymentSplit[];
  
  // Payment tracking (Customizable deposit & remaining)
  depositPaid: boolean;
  depositAmount: number; // Custom deposit/sinal amount (R$)
  depositPercent?: number; // Custom deposit percentage (e.g. 50, 100, 30, 60, 0)
  depositDate?: string;
  
  remainingPaid: boolean;
  remainingAmount: number; // Custom remaining amount (R$)
  remainingPaymentNotes?: string; // Custom negotiation notes for remaining balance (e.g., "3x no cartão na conclusão")
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
