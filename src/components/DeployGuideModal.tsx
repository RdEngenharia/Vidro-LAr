import React from 'react';
import { Github, Cloud, Database, FileText, CheckCircle2, ArrowRight, X } from 'lucide-react';

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
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Guia de Integração & Deploy (GitHub, Vercel & Firebase)</h3>
              <p className="text-xs text-slate-500">Como publicar o projeto no GitHub/Vercel e configurar a sincronização offline no Firebase</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-700">
          
          {/* Step 1: GitHub & Logo */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Github className="w-4 h-4 text-slate-800" />
              <span>1. Repositório no GitHub & Inserção da Logo</span>
            </div>
            <p>
              Para subir este código para o GitHub e adicionar a logo oficial da vidraçaria:
            </p>
            <ol className="list-decimal list-inside space-y-1 font-mono text-[11px] text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
              <li>Exporte ou baixe os arquivos do projeto para o seu computador.</li>
              <li>Coloque o arquivo da sua logo (ex: <code>logo-vidracaria.png</code>) na pasta <code>/public</code>.</li>
              <li>Execute <code>git init && git add . && git commit -m "Inicializando Vidraçaria Pro"</code>.</li>
              <li>Crie um repositório no GitHub e faça o push com <code>git push origin main</code>.</li>
            </ol>
          </div>

          {/* Step 2: Vercel Deploy */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>2. Deploy Gratuito na Vercel</span>
            </div>
            <p>
              Para publicar online na Vercel com HTTPS e PWA (funciona em celulares e computadores):
            </p>
            <ol className="list-decimal list-inside space-y-1 font-mono text-[11px] text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
              <li>Acesse <strong>vercel.com</strong> e conecte sua conta do GitHub.</li>
              <li>Importe o repositório da sua vidraçaria.</li>
              <li>O Framework Preset será detectado automaticamente como <strong>Vite / React</strong>.</li>
              <li>Clique em <strong>Deploy</strong>. Seu sistema estará no ar em segundos!</li>
            </ol>
          </div>

          {/* Step 3: Firebase Offline Sync */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Database className="w-4 h-4 text-amber-600" />
              <span>3. Sincronização Offline (IndexedDB + Firebase Firestore)</span>
            </div>
            <p>
              Este sistema foi construído com arquitetura <strong>Offline-First</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-800">
              <li><strong>Sem Internet:</strong> Todos os orçamentos, produtos e clientes são salvos instantaneamente no banco de dados local <strong>IndexedDB</strong> do navegador.</li>
              <li><strong>Ao Voltar a Conexão:</strong> O <code>SyncEngine</code> detecta a internet e envia a fila de sincronização automaticamente para a coleção <code>tenants/{'{tenantId}'}</code> no Firebase Firestore.</li>
              <li><strong>Multitenant / SaaS:</strong> Cada vidraçaria utiliza uma chave isolada (<code>tenantId</code>), impedindo vazamento de dados entre empresas distintas.</li>
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
