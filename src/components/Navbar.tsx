import React from 'react';
import { useAuth } from '../lib/authContext';
import { SyncBadge } from './SyncBadge';
import { Building2, LogOut, PlusCircle, Search, ShieldCheck, RefreshCw, Terminal } from 'lucide-react';

interface NavbarProps {
  onNewQuoteClick: () => void;
  onDeployGuideClick: () => void;
  onDevConsoleClick: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNewQuoteClick,
  onDeployGuideClick,
  onDevConsoleClick,
  searchTerm,
  onSearchChange,
}) => {
  const { user, settings, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Company Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm border border-slate-800">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  {settings?.companyName || user?.companyName || 'Vidraçaria Pro'}
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  SaaS Multi-tenant
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {settings?.tagline || 'Portas • Janelas • Espelhos • Box & Vidros'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar orçamento por código, cliente, telefone..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Actions & Sync Badge */}
          <div className="flex items-center gap-2.5">
            <SyncBadge />

            <button
              onClick={onDevConsoleClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 cursor-pointer shadow-2xs"
              title="Painel do Desenvolvedor - Registro de Erros e Falhas dos Usuários"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Modo Dev</span>
            </button>

            <button
              onClick={onDeployGuideClick}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              title="Atualização e Sincronização do Sistema"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
              <span>Atualizar</span>
            </button>

            <button
              onClick={onNewQuoteClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-blue-400" />
              <span>Novo Orçamento</span>
            </button>

            {/* Profile Dropdown / Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-900 leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate max-w-[120px]" title={user?.email}>
                  {user?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
