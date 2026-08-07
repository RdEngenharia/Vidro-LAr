import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, CompanySettings } from '../types';
import { initializeTenantData, getCompanySettings, saveCompanySettings } from './db';
import { syncEngine } from './sync';

interface AuthContextType {
  user: UserProfile | null;
  settings: CompanySettings | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, companyName: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateSettings: (newSettings: CompanySettings) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'vidracaria_pro_user';
const USERS_DB_KEY = 'vidracaria_pro_registered_users';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on load
  useEffect(() => {
    const initAuth = async () => {
      const savedUserStr = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUserStr) {
        try {
          const savedUser: UserProfile = JSON.parse(savedUserStr);
          await loadTenant(savedUser);
        } catch (e) {
          console.error('Failed to parse saved user', e);
          createDefaultDemoUser();
        }
      } else {
        createDefaultDemoUser();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const createDefaultDemoUser = async () => {
    const demoUser: UserProfile = {
      uid: 'user_coroa_alta',
      tenantId: 'tenant_coroa_alta',
      email: 'vidramarcoroaalta@hotmail.com',
      name: 'Vidraçaria Coroa Alta',
      companyName: 'Vidraçaria Coroa Alta',
    };
    await loadTenant(demoUser);
  };

  const loadTenant = async (u: UserProfile) => {
    setUser(u);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
    syncEngine.setTenantId(u.tenantId);
    
    // Seed initial IndexedDB tables if needed
    await initializeTenantData(u.tenantId, u.companyName);
    
    // Load company settings
    const companySettings = await getCompanySettings(u.tenantId);
    if (companySettings) {
      setSettings(companySettings);
    }
  };

  const login = async (email: string, _pass: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Find or create tenant for this email
      const safeEmail = email.trim().toLowerCase();
      const usersRaw = localStorage.getItem(USERS_DB_KEY);
      const registeredUsers: UserProfile[] = usersRaw ? JSON.parse(usersRaw) : [];

      let found = registeredUsers.find((u) => u.email.toLowerCase() === safeEmail);

      if (!found) {
        // Auto register/create tenant if logging in with new credentials
        const tenantId = `tenant_${safeEmail.replace(/[^a-z0-9]/g, '_')}`;
        const namePart = email.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        found = {
          uid: `uid_${Date.now()}`,
          tenantId,
          email: safeEmail,
          name: formattedName,
          companyName: `Vidraçaria ${formattedName}`,
        };
        registeredUsers.push(found);
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(registeredUsers));
      }

      await loadTenant(found);
      setLoading(false);
      return true;
    } catch (e) {
      console.error('Login error', e);
      setLoading(false);
      return false;
    }
  };

  const register = async (name: string, companyName: string, email: string, _pass: string): Promise<boolean> => {
    setLoading(true);
    try {
      const safeEmail = email.trim().toLowerCase();
      const tenantId = `tenant_${safeEmail.replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
      
      const newUser: UserProfile = {
        uid: `uid_${Date.now()}`,
        tenantId,
        email: safeEmail,
        name,
        companyName,
      };

      const usersRaw = localStorage.getItem(USERS_DB_KEY);
      const registeredUsers: UserProfile[] = usersRaw ? JSON.parse(usersRaw) : [];
      registeredUsers.push(newUser);
      localStorage.setItem(USERS_DB_KEY, JSON.stringify(registeredUsers));

      await loadTenant(newUser);
      setLoading(false);
      return true;
    } catch (e) {
      console.error('Registration error', e);
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setSettings(null);
    localStorage.removeItem(LOCAL_USER_KEY);
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
