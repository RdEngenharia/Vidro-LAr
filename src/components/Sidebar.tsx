import React from 'react';
import {
  FileText,
  Users,
  Grid,
  Settings,
  CloudCheck,
  ShieldCheck,
  Building,
  DollarSign
} from 'lucide-react';

export type TabType = 'quotes' | 'customers' | 'categories' | 'settings' | 'deploy';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  quotesCount: number;
  customersCount: number;
  categoriesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  quotesCount,
  customersCount,
  categoriesCount,
}) => {
  const navItems = [
    {
      id: 'quotes' as TabType,
      label: 'Orçamentos & Pedidos',
      icon: FileText,
      badge: quotesCount,
    },
    {
      id: 'customers' as TabType,
      label: 'Cadastro de Clientes',
      icon: Users,
      badge: customersCount,
    },
    {
      id: 'categories' as TabType,
      label: 'Categorias & Preços',
      icon: Grid,
      badge: categoriesCount,
    },
    {
      id: 'settings' as TabType,
      label: 'Dados da Vidraçaria',
      icon: Settings,
    },
    {
      id: 'deploy' as TabType,
      label: 'GitHub, Vercel & Firebase',
      icon: CloudCheck,
    },
  ];

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

      {/* Financial status summary helper card */}
      <div className="p-4 mx-4 my-2 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs mb-1">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Controle de 50% Entrada</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Na vidraçaria, o cliente paga 50% de entrada para congelar valores e os 50% restantes após a conclusão da obra (até 1 ano).
        </p>
      </div>
    </aside>
  );
};
