import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from './firebase';

function requireFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Cloud Functions não configuradas. Verifique se o projeto Firebase tem o plano Blaze ativo.');
  }
  return firebaseFunctions;
}

export interface CnpjCheckResult {
  ok: boolean;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
}

// Chamada ANTES de criar a conta — valida e consulta a Receita, mas não trava
// nada ainda (a pessoa pode desistir do cadastro).
export async function checkCnpjAvailable(cnpj: string): Promise<CnpjCheckResult> {
  const fn = httpsCallable(requireFunctions(), 'checkCnpjAvailable');
  const res = await fn({ cnpj });
  return res.data as CnpjCheckResult;
}

// Chamada LOGO DEPOIS de criar a conta (já autenticado) — trava o CNPJ nessa
// conta de forma atômica (transação no servidor).
export async function registerCnpj(cnpj: string): Promise<{ ok: boolean; razaoSocial: string }> {
  const fn = httpsCallable(requireFunctions(), 'registerCnpj');
  const res = await fn({ cnpj });
  return res.data as { ok: boolean; razaoSocial: string };
}
