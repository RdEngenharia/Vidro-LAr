import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { Building2, LogOut, PlusCircle, Terminal, KeyRound } from 'lucide-react';

interface NavbarProps {
  onNewQuoteClick: () => void;
  onDeployGuideClick: () => void;
  onDevConsoleClick: () => void;
  onCloudSyncClick?: () => void;
  isCloudSyncing?: boolean;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

// Cabeçalho enxuto por decisão do usuário: sem selo de "Online", sem "Baixar da
// Nuvem", sem "Atualizar" e sem campo de busca duplicado (a busca já existe na
// própria lista de orçamentos). Essas ações continuam acessíveis: a atualização
// do sistema pelo menu lateral ("Atualizar Sistema"), e a busca na tela de
// Orçamentos e Pedidos.
export const Navbar: React.FC<NavbarProps> = ({
  onNewQuoteClick,
  onDevConsoleClick,
}) => {
  const { user, settings, logout } = useAuth();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Brand & Company Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm border border-slate-800 overflow-hidden">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  {settings?.companyName || user?.companyName || 'Vidraçaria Pro'}
                </h1>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {settings?.tagline || 'Portas • Janelas • Espelhos • Box & Vidros'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onDevConsoleClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 cursor-pointer shadow-2xs"
              title="Painel do Desenvolvedor - Registro de Erros e Falhas dos Usuários"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Modo Dev</span>
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
                onClick={() => setIsChangePasswordOpen(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Alterar Senha"
              >
                <KeyRound className="w-4 h-4" />
              </button>
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
