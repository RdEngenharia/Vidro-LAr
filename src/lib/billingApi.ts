// ---------------------------------------------------------------------------
// Cliente para a assinatura do sistema (SaaS) — Mercado Pago.
// ---------------------------------------------------------------------------
// O navegador nunca decide o próprio plano: só chama estas funções, que
// rodam no servidor e são a única coisa que grava o status de assinatura.
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from './firebase';
import { BillingCycle, SubscriptionPaymentMethod, SubscriptionStatus } from '../types';

function requireFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Cloud Functions não configuradas. Verifique se o projeto Firebase tem o plano Blaze ativo.');
  }
  return firebaseFunctions;
}

export async function ensureTrialStarted(): Promise<void> {
  const fn = httpsCallable(requireFunctions(), 'ensureTrialStarted');
  await fn({});
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const fn = httpsCallable(requireFunctions(), 'getSubscriptionStatus');
  const res = await fn({});
  return res.data as SubscriptionStatus;
}

export interface CheckoutParams {
  billingCycle: BillingCycle;
  paymentMethod: SubscriptionPaymentMethod;
  payerEmail: string;
  cardToken?: string;
  idempotencyKey: string;
}

export interface CheckoutResult {
  ok: boolean;
  status: string;
  type: 'recurring' | 'single';
  paymentId?: string;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
}

export async function createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  const fn = httpsCallable(requireFunctions(), 'createCheckout');
  const res = await fn(params);
  return res.data as CheckoutResult;
}

// Gera uma chave de idempotência ESTÁVEL para uma única tentativa de compra —
// deve ser criada UMA VEZ quando a tela de checkout abre (guardada em estado
// do componente) e reaproveitada em toda tentativa/retry da MESMA compra, até
// o pagamento concluir ou a tela fechar. Usa só aleatoriedade (crypto.randomUUID
// quando disponível) DE PROPÓSITO — sem timestamp dentro: se essa função fosse
// chamada de novo a cada tentativa, a proteção contra clique duplo desligaria
// (cada chamada geraria uma chave "nova" mesmo sendo a mesma compra).
export function generateIdempotencyKey(tenantId: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `chk_${tenantId}_${random}`;
}
