// ---------------------------------------------------------------------------
// Cliente para o cofre de boletos e emissão de boletos.
// ---------------------------------------------------------------------------
// Toda operação sensível (salvar/usar credenciais de banco) passa por uma
// Cloud Function (ver /functions/index.js) — o navegador nunca vê nem grava
// a chave secreta diretamente. Isso mantém as credenciais de cada vidraçaria
// isoladas e fora de alcance do próprio código do navegador.
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { functions as firebaseFunctions, db as firebaseDb, ensureFirebaseAuth } from './firebase';
import { Boleto, BoletoProvider } from '../types';

function requireFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Cloud Functions não configuradas. Verifique se o projeto Firebase tem o plano Blaze ativo.');
  }
  return firebaseFunctions;
}

export interface BoletoConfigStatus {
  configured: boolean;
  provider: BoletoProvider | null;
  ambiente?: 'producao' | 'homologacao';
  identificacao?: string;
}

// Lê só o status público (sem segredo nenhum) de configuração do cofre —
// documento explicitamente liberado para leitura do próprio dono nas regras
// do Firestore (diferente do cofre em si, que é 100% bloqueado ao cliente).
export async function getBoletoConfigStatus(tenantId: string): Promise<BoletoConfigStatus> {
  await ensureFirebaseAuth();
  if (!firebaseDb) return { configured: false, provider: null };
  const snap = await getDoc(doc(firebaseDb, 'tenants', tenantId, 'boletoConfig', 'status'));
  if (!snap.exists()) return { configured: false, provider: null };
  const data = snap.data() as any;
  return {
    configured: !!data.configured,
    provider: data.provider || null,
    ambiente: data.ambiente || 'producao',
    identificacao: data.identificacao || '',
  };
}

export async function getBoletoProviders(): Promise<
  Array<{
    id: BoletoProvider;
    label: string;
    implemented: boolean;
    credentialFields: Array<{
      id: string;
      label: string;
      type: 'text' | 'password' | 'file';
      optional?: boolean;
      accept?: string;
      hint?: string;
    }>;
  }>
> {
  const fn = httpsCallable(requireFunctions(), 'getBoletoProviders');
  const res = await fn({});
  return (res.data as any).providers || [];
}

export async function saveBoletoCredentials(params: {
  provider: BoletoProvider;
  ambiente: 'producao' | 'homologacao';
  clientId?: string;
  apiKey?: string;
  clientSecret?: string;
  certificateBase64?: string;
  certificatePassword?: string;
}): Promise<void> {
  const fn = httpsCallable(requireFunctions(), 'saveBoletoCredentials');
  await fn(params);
}

export async function removeBoletoCredentials(): Promise<void> {
  const fn = httpsCallable(requireFunctions(), 'removeBoletoCredentials');
  await fn({});
}

export interface IssueBoletoParams {
  customerId?: string;
  customerName: string;
  customerDocument?: string; // CPF/CNPJ do pagador
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: {
    logradouro: string;
    numero?: string;
    bairro?: string;
    cidade: string;
    uf: string;
    cep?: string;
  };
  quoteId?: string;
  quoteCodeNumber?: number;
  amount: number;
  dueDate: string;
  description?: string;
}

export interface IssueBoletoResult {
  ok: boolean;
  simulated: boolean;
  boletoId: string;
  barcode?: string;
  boletoUrl?: string | null;
  status: string;
  message?: string;
}

export async function issueBoleto(params: IssueBoletoParams): Promise<IssueBoletoResult> {
  const fn = httpsCallable(requireFunctions(), 'issueBoleto');
  const res = await fn(params);
  return res.data as IssueBoletoResult;
}

export async function getBoletos(tenantId: string): Promise<Boleto[]> {
  await ensureFirebaseAuth();
  if (!firebaseDb) return [];
  const snap = await getDocs(collection(firebaseDb, 'tenants', tenantId, 'boletos'));
  const boletos = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      ...data,
      // createdAt vem como Firestore Timestamp — normaliza para string ISO
      createdAt:
        data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || new Date().toISOString(),
    } as Boleto;
  });
  return boletos.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
