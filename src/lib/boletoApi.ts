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
  return { configured: !!data.configured, provider: data.provider || null };
}

export async function saveBoletoCredentials(params: {
  provider: BoletoProvider;
  clientId: string;
  clientSecret: string;
  extra?: Record<string, string>;
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
