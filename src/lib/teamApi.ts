// ---------------------------------------------------------------------------
// Cliente para gestão de equipe (mestre + até 2 usuários com permissões).
// ---------------------------------------------------------------------------
// Toda operação sensível (criar login, definir permissões, remover usuário)
// passa por uma Cloud Function — o navegador nunca cria contas de Firebase
// Authentication diretamente nem grava Custom Claims por conta própria.
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from './firebase';
import { TeamMember, TeamMemberPermissions } from '../types';

function requireFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Cloud Functions não configuradas. Verifique se o projeto Firebase tem o plano Blaze ativo.');
  }
  return firebaseFunctions;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const fn = httpsCallable(requireFunctions(), 'listTeamMembers');
  const res = await fn({});
  return ((res.data as any)?.members || []) as TeamMember[];
}

export async function createTeamMember(params: {
  name: string;
  email: string;
  password: string;
  permissions: TeamMemberPermissions;
}): Promise<{ uid: string }> {
  const fn = httpsCallable(requireFunctions(), 'createTeamMember');
  const res = await fn(params);
  return res.data as { uid: string };
}

export async function updateTeamMemberPermissions(params: {
  memberUid: string;
  permissions: TeamMemberPermissions;
  name?: string;
}): Promise<void> {
  const fn = httpsCallable(requireFunctions(), 'updateTeamMemberPermissions');
  await fn(params);
}

export async function removeTeamMember(memberUid: string): Promise<void> {
  const fn = httpsCallable(requireFunctions(), 'removeTeamMember');
  await fn({ memberUid });
}
