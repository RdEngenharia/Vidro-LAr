import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { UserProfile, CompanySettings } from '../types';
import { initializeTenantData, getCompanySettings, saveCompanySettings } from './db';
import { syncEngine } from './sync';
import { auth as firebaseAuth } from './firebase';

interface AuthContextType {
  user: UserProfile | null;
  settings: CompanySettings | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, companyName: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateSettings: (newSettings: CompanySettings) => Promise<void>;
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
    default:
      return 'Não foi possível autenticar. Tente novamente.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fonte da verdade da sessão: Firebase Authentication (e-mail/senha real).
  // O UID do Firebase vira o `tenantId` — é ele que garante, nas regras do Firestore
  // (allow read, write: if request.auth.uid == tenantId) e no particionamento do
  // IndexedDB local, que cada vidraçaria só enxerga seus próprios dados.
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
    const tenantId = firebaseUser.uid;

    syncEngine.setTenantId(tenantId);

    // Garante dados iniciais (categorias/produtos/config padrão) na primeira vez deste tenant
    await initializeTenantData(tenantId, fallbackCompanyName || firebaseUser.displayName || 'Minha Vidraçaria', firebaseUser.email || '');

    const companySettings = await getCompanySettings(tenantId);

    const profile: UserProfile = {
      uid: firebaseUser.uid,
      tenantId,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      companyName: companySettings?.companyName || fallbackCompanyName || '',
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
      setAuthError(translateFirebaseAuthError(err?.code));
      return false;
    }
  };

  const register = async (
    name: string,
    companyName: string,
    email: string,
    pass: string
  ): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseAuth) {
      setAuthError('Firebase não configurado. Verifique o arquivo .env do projeto.');
      return false;
    }
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), pass);

      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      // Cria os dados iniciais do tenant já com o nome real da vidraçaria informado no cadastro
      await initializeTenantData(cred.user.uid, companyName || name || 'Minha Vidraçaria', cred.user.email || '');
      const existingSettings = await getCompanySettings(cred.user.uid);
      if (existingSettings && companyName) {
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
      setAuthError(translateFirebaseAuthError(err?.code));
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
