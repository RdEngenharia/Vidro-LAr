import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { Building2, Lock, Mail, User, ShieldCheck, ArrowRight, WifiOff, Terminal } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onDevConsoleClick?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onDevConsoleClick }) => {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  // Form states
  const [email, setEmail] = useState('vidramarcoroaalta@hotmail.com');
  const [password, setPassword] = useState('123456');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isRegistering) {
      if (!name || !companyName || !email || !password) {
        setErrorMessage('Preencha todos os campos obrigatórios');
        return;
      }
      const success = await register(name, companyName, email, password);
      if (!success) {
        setErrorMessage('Erro ao criar conta da vidraçaria.');
      }
    } else {
      if (!email || !password) {
        setErrorMessage('Informe e-mail e senha');
        return;
      }
      const success = await login(email, password);
      if (!success) {
        setErrorMessage('Credenciais inválidas');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative">
          {onDevConsoleClick && (
            <button
              onClick={onDevConsoleClick}
              type="button"
              className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer shadow-xs"
              title="Abrir Painel do Desenvolvedor"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Modo Dev</span>
            </button>
          )}

          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-lg mb-3 border border-blue-400">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Sistema Vidraçaria Pro</h2>
          <p className="text-xs text-slate-300 mt-1">
            Plataforma SaaS de Orçamentos & Pedidos com Suporte Offline (IndexedDB + Firebase)
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-blue-300 text-[11px] font-semibold border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Dados Isolados por Empresa (Multi-Tenant)</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seu Nome</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Carlos Oliveira"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Vidraçaria</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Vidraçaria Coroa Alta"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vidramarcoroaalta@hotmail.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isRegistering ? 'Cadastrar Minha Vidraçaria' : 'Entrar no Sistema'}</span>
              <ArrowRight className="w-4 h-4 text-blue-400" />
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              {isRegistering
                ? 'Já possui uma vidraçaria? Faça login aqui'
                : 'Quer cadastrar uma nova vidraçaria? Clique aqui'}
            </button>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Funciona 100% Offline via IndexedDB e sincroniza no Firebase quando houver internet.</span>
          </div>

          {onDevConsoleClick && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onDevConsoleClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                <span>Painel do Desenvolvedor (Ver Erros & Logs)</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
