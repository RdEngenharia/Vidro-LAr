import React from 'react';
import { RefreshCw, ShieldCheck, Database, FileText, CheckCircle2, Wifi, X } from 'lucide-react';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center font-bold">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Sincronização e Atualização do Sistema</h3>
              <p className="text-xs text-slate-500">Informações sobre salvamento automático, modo offline e atualização dos seus orçamentos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-700">
          
          {/* Section 1: Offline & Auto-Save */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>1. Funcionamento Offline & Salvamento Instantâneo</span>
            </div>
            <p>
              O sistema foi desenvolvido para funcionar continuamente sem interrupções:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-800">
              <li><strong>Sem internet:</strong> Seus orçamentos, cadastros de clientes e preços são salvos com segurança no próprio dispositivo.</li>
              <li><strong>Agilidade total:</strong> Você pode emitir novos orçamentos mesmo em locais de obra sem sinal de celular.</li>
            </ul>
          </div>

          {/* Section 2: Cloud Sync */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>2. Atualização Automática na Nuvem</span>
            </div>
            <p>
              Assim que o dispositivo se reconecta à internet, o sistema sincroniza os dados automaticamente:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-800">
              <li>Todos os orçamentos alterados são atualizados em tempo real.</li>
              <li>Garante backup das suas informações e proteção contra perdas acidentais.</li>
            </ul>
          </div>

          {/* Section 3: Data Security */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>3. Privacidade e Isolamento dos Dados da Empresa</span>
            </div>
            <p>
              Segurança e sigilo comercial para a sua vidraçaria:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-800">
              <li>Cada empresa possui uma conta totalmente isolada e protegida.</li>
              <li>Nenhuma outra vidraçaria tem acesso às suas tabelas de preços ou lista de clientes.</li>
            </ul>
          </div>

        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
