import React, { useState, useEffect } from 'react';
import { syncEngine, SyncStatus } from '../lib/sync';
import { Wifi, WifiOff } from 'lucide-react';

export const SyncBadge: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs">
      {status.isOnline ? (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200"
          title="Conectado — os dados são salvos direto no Firebase"
        >
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>Online</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200"
          title="Sem conexão — as alterações ficam guardadas no dispositivo e são enviadas automaticamente quando a internet voltar"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span>Modo Offline</span>
        </span>
      )}
    </div>
  );
};
