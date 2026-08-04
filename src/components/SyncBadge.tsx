import React, { useState, useEffect } from 'react';
import { syncEngine, SyncStatus } from '../lib/sync';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export const SyncBadge: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = () => {
    syncEngine.syncNow();
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {status.isOnline ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>Online</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200" title="Modo Offline Ativo - Dados salvos no dispositivo local">
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span>Modo Offline</span>
        </span>
      )}

      {status.pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={status.isSyncing || !status.isOnline}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium border border-blue-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clique para atualizar e sincronizar dados"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin text-blue-600' : ''}`} />
          <span>{status.pendingCount} pendente{status.pendingCount > 1 ? 's' : ''}</span>
        </button>
      )}

      {status.pendingCount === 0 && status.isOnline && (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">Sincronizado</span>
        </span>
      )}
    </div>
  );
};
