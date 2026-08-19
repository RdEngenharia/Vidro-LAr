import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { UserProfile, CompanySettings, TeamMemberPermissions } from '../types';
import { initializeTenantData, getCompanySettings, saveCompanySettings, saveMasterTeamMemberSelf } from './db';
import { ensureTrialStarted } from './billingApi';
import { registerCnpj } from './cnpjApi';
import { auth as firebaseAuth } from './firebase';
import { logError } from './logger';

interface AuthContextType {
  user: UserProfile | null;
  settings: CompanySettings | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, companyName: string, email: string, pass: string, cnpj: string) => Promise<boolean>;
  logout: () => void;
  updateSettings: (newSettings: CompanySettings) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Traduz os códigos de erro do Firebase Auth para mensagens compreensíveis em pt-BR
function translateFirebaseAuthError(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Faça login em vez de cadastrar uma nova conta.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.';
    case 'auth/missing-password':
      return 'Informe a senha.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet. É necessário estar online no primeiro acesso deste dispositivo.';
    case 'auth/unauthorized-domain':
      return `Este endereço (${typeof window !== 'undefined' ? window.location.hostname : ''}) não está autorizado no Firebase. Peça ao administrador para adicioná-lo em Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Login por e-mail/senha não está habilitado no Firebase. Ative em Authentication → Sign-in method → Email/senha.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'Configuração do Firebase inválida (chave de API incorreta). Verifique as variáveis de ambiente.';
    case 'auth/configuration-not-found':
      return 'Provedor de login não configurado no Firebase. Ative Email/senha em Authentication → Sign-in method.';
    case 'auth/requires-recent-login':
      return 'Por segurança, faça login novamente antes de trocar a senha.';
    default:
      return code
        ? `Não foi possível autenticar (código: ${code}). Veja detalhes no Painel do Desenvolvedor.`
        : 'Não foi possível autenticar. Tente novamente.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fonte da verdade da sessão: Firebase Authentication (e-mail/senha real).
  // O primeiro usuário de cada conta é o "mestre" — o próprio UID dele já É o
  // tenantId, exatamente como sempre foi neste sistema. Usuários criados por
  // ele ("membros") são contas de login PRÓPRIAS, vinculadas ao tenant do
  // mestre e às permissões deles através de uma Custom Claim gravada no
  // token de login — não existe outro jeito seguro de fazer isso sem dar a
  // um membro acesso total só por estar logado.
  useEffect(() => {
    if (!firebaseAuth) {
      console.warn('Firebase não inicializado — verifique o arquivo .env');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          await loadTenant(firebaseUser);
        } else {
          setUser(null);
          setSettings(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadTenant = async (firebaseUser: FirebaseUser, fallbackCompanyName?: string) => {
    // Força atualizar o token para pegar a Custom Claim mais recente — sem
    // isso, uma alteração de permissão feita pelo mestre só valeria depois
    // de até 1h (tempo padrão de cache do token do Firebase).
    const tokenResult = await firebaseUser.getIdTokenResult(true);
    const claims = tokenResult.claims as { tenantId?: string; role?: string; permissions?: Partial<TeamMemberPermissions> };

    const isMember = claims.role === 'member';
    const tenantId = isMember && claims.tenantId ? claims.tenantId : firebaseUser.uid;

    if (!isMember) {
      // Garante os 7 dias de teste grátis ANTES de qualquer outra gravação —
      // as regras do Firestore agora exigem assinatura ativa pra gravar
      // categorias/produtos, então isso precisa vir primeiro. A própria
      // function já checa se já existe, então é seguro chamar em todo login.
      try {
        await ensureTrialStarted();
      } catch (err) {
        console.warn('Não foi possível verificar/iniciar o teste grátis:', err);
      }
      // Só o mestre semeia/inicializa os dados do tenant (categorias padrão,
      // configurações vazias) — um membro nunca "cria" um tenant novo.
      await initializeTenantData(tenantId, fallbackCompanyName || firebaseUser.displayName || 'Minha Vidraçaria', firebaseUser.email || '');
      // Garante que o mestre também aparece na lista de "Usuários" do sistema,
      // não só os membros criados por ele.
      await saveMasterTeamMemberSelf(tenantId, firebaseUser.displayName || '', firebaseUser.email || '');
    }

    const companySettings = await getCompanySettings(tenantId);

    const permissions: TeamMemberPermissions = isMember
      ? {
          orcamentos: !!claims.permissions?.orcamentos,
          clientes: !!claims.permissions?.clientes,
          precos: !!claims.permissions?.precos,
          boletos: !!claims.permissions?.boletos,
        }
      : { orcamentos: true, clientes: true, precos: true, boletos: true, estoque: true };

    const profile: UserProfile = {
      uid: firebaseUser.uid,
      tenantId,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      companyName: companySettings?.companyName || fallbackCompanyName || '',
      role: isMember ? 'member' : 'master',
      permissions,
    };

    if (companySettings) setSettings(companySettings);
    setUser(profile);
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseAuth) {
      setAuthError('Firebase não configurado. Verifique o arquivo .env do projeto.');
      return false;
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), pass);
      return true;
    } catch (err: any) {
      logError('AUTH_LOGIN', err, { email: email.trim().toLowerCase() });
      setAuthError(translateFirebaseAuthError(err?.code));
      return false;
    }
  };

  const register = async (
    name: string,
    companyName: string,
    email: string,
    pass: string,
    cnpj: string
  ): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseAuth) {
      setAuthError('Firebase não configurado. Verifique o arquivo .env do projeto.');
      return false;
    }
    if (!cnpj || !cnpj.trim()) {
      setAuthError('O CNPJ é obrigatório para criar uma conta.');
      return false;
    }
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), pass);

      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      // Trava o CNPJ nesta conta logo após criá-la (já autenticado, a
      // transação no servidor confere de novo que ninguém pegou esse CNPJ
      // entre a validação da tela e este momento). Feito ANTES de qualquer
      // outra gravação — se o CNPJ já estiver em uso, a conta de login já
      // foi criada, mas nenhum dado do tenant chega a ser gravado.
      await registerCnpj(cnpj.trim());

      // IMPORTANTE: o teste grátis precisa ser garantido ANTES de gravar
      // qualquer dado do tenant (categorias, produtos). As regras do
      // Firestore agora exigem assinatura ativa pra gravar nessas coleções
      // — sem o registro de teste grátis existir primeiro, a próxima
      // chamada (initializeTenantData) seria recusada.
      await ensureTrialStarted();

      // Cria os dados iniciais do tenant já com o nome real da vidraçaria informado no cadastro
      await initializeTenantData(cred.user.uid, companyName || name || 'Minha Vidraçaria', cred.user.email || '');
      const existingSettings = await getCompanySettings(cred.user.uid);
      if (existingSettings && companyName) {
        // Nota: o CNPJ NÃO é reenviado aqui de propósito — ele já foi gravado
        // pela Cloud Function acima (registerCnpj), que é o único lugar que
        // grava esse campo. Isso mantém o CNPJ travado desde o primeiro
        // segundo da conta, sem depender do formulário nunca mais tocar nele.
        const updated: CompanySettings = {
          ...existingSettings,
          companyName,
          tradeName: companyName,
          email: email.trim().toLowerCase(),
        };
        await saveCompanySettings(updated);
      }

      // onAuthStateChanged vai disparar e carregar o tenant automaticamente,
      // mas carregamos aqui também para a UI atualizar sem esperar o listener.
      await loadTenant(cred.user, companyName);
      return true;
    } catch (err: any) {
      logError('AUTH_REGISTER', err, { email: email.trim().toLowerCase(), companyName });
      setAuthError(err?.message || translateFirebaseAuthError(err?.code));
      return false;
    }
  };

  const logout = () => {
    if (firebaseAuth) {
      signOut(firebaseAuth).catch((err) => console.warn('Erro ao sair:', err?.message));
    }
    setUser(null);
    setSettings(null);
  };

  const updateSettings = async (newSettings: CompanySettings) => {
    await saveCompanySettings(newSettings);
    setSettings(newSettings);
  };

  // Envia e-mail de recuperação de senha (para quem esqueceu e não está logado)
  const requestPasswordReset = async (email: string): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseAuth) {
      setAuthError('Firebase não configurado. Verifique o arquivo .env do projeto.');
      return false;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());
      return true;
    } catch (err: any) {
      logError('AUTH_PASSWORD_RESET', err, { email: email.trim().toLowerCase() });
      setAuthError(translateFirebaseAuthError(err?.code));
      return false;
    }
  };

  // Troca a senha de dentro do sistema, com o usuário já logado.
  // O Firebase exige reautenticação recente por segurança antes de trocar a senha.
  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseAuth || !firebaseAuth.currentUser || !firebaseAuth.currentUser.email) {
      setAuthError('Nenhum usuário autenticado.');
      return false;
    }
    try {
      const credential = EmailAuthProvider.credential(firebaseAuth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseAuth.currentUser, credential);
      await updatePassword(firebaseAuth.currentUser, newPassword);
      return true;
    } catch (err: any) {
      logError('AUTH_CHANGE_PASSWORD', err, { email: firebaseAuth.currentUser?.email });
      setAuthError(translateFirebaseAuthError(err?.code));
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        loading,
        authError,
        login,
        register,
        logout,
        updateSettings,
        requestPasswordReset,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
