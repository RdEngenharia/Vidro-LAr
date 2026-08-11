import React from 'react';
import {
  FileText,
  Users,
  Grid,
  Settings,
  RefreshCw,
  ShieldCheck,
  Building,
  Receipt,
  UserCog
} from 'lucide-react';
import { TeamMemberPermissions } from '../types';

export type TabType = 'quotes' | 'customers' | 'categories' | 'settings' | 'deploy' | 'boletos' | 'usuarios';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  quotesCount: number;
  customersCount: number;
  categoriesCount: number;
  role: 'master' | 'member';
  permissions: TeamMemberPermissions;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  quotesCount,
  customersCount,
  categoriesCount,
  role,
  permissions,
}) => {
  const isMaster = role === 'master';

  // Cada aba só aparece se a pessoa tiver a permissão correspondente — o
  // mestre sempre vê tudo. "Usuários" e "Dados da Vidraçaria" são exclusivas
  // do mestre (gestão de equipe e dados da empresa não são delegáveis).
  const navItems = [
    {
      id: 'quotes' as TabType,
      label: 'Orçamentos & Pedidos',
      icon: FileText,
      badge: quotesCount,
      visible: isMaster || permissions.orcamentos,
    },
    {
      id: 'customers' as TabType,
      label: 'Cadastro de Clientes',
      icon: Users,
      badge: customersCount,
      visible: isMaster || permissions.clientes,
    },
    {
      id: 'categories' as TabType,
      label: 'Categorias & Preços',
      icon: Grid,
      badge: categoriesCount,
      visible: isMaster || permissions.precos,
    },
    {
      id: 'boletos' as TabType,
      label: 'Emitir Boletos',
      icon: Receipt,
      visible: isMaster || permissions.boletos,
    },
    {
      id: 'usuarios' as TabType,
      label: 'Usuários',
      icon: UserCog,
      visible: isMaster,
    },
    {
      id: 'settings' as TabType,
      label: 'Dados da Vidraçaria',
      icon: Settings,
      visible: isMaster,
    },
    {
      id: 'deploy' as TabType,
      label: 'Atualizar Sistema',
      icon: RefreshCw,
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0">
      <div className="p-4 space-y-1">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navegação Principal
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
