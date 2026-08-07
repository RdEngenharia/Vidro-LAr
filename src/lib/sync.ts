// ---------------------------------------------------------------------------
// Monitor de conectividade.
// ---------------------------------------------------------------------------
// Antes, este arquivo também continha um motor de sincronização customizado
// (fila local + envio manual para o Firestore). Isso foi removido: agora todas
// as leituras/escritas vão direto para o Firestore (ver db.ts), e o próprio
// SDK do Firestore cuida do enfileiramento offline e da sincronização quando a
// conexão volta, através do cache local persistente configurado em firebase.ts.
//
// O que resta aqui é só o indicador visual de "Online / Offline" (SyncBadge) e
// um aviso explícito para o Firestore pausar/retomar tentativas de rede quando
// a conectividade muda — isso deixa a detecção de reconexão mais ágil.
import { db as firebaseDb } from './firebase';
import { enableNetwork, disableNetwork } from 'firebase/firestore';

export interface SyncStatus {
  isOnline: boolean;
}

type SyncListener = (status: SyncStatus) => void;

class ConnectivityMonitor {
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    window.addEventListener('online', () => this.checkConnectivity());
    window.addEventListener('offline', () => this.setOnline(false));

    this.checkConnectivity();
    setInterval(() => this.checkConnectivity(), 8000);
  }

  public async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      this.setOnline(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`/favicon.ico?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const online = res.ok || res.status < 500;
      this.setOnline(online);
      return online;
    } catch {
      this.setOnline(false);
      return false;
    }
  }

  private setOnline(online: boolean) {
    if (this.isOnline === online) return;
    this.isOnline = online;
    this.notify();

    // Avisa o Firestore explicitamente sobre a mudança de rede, para ele reagir
    // mais rápido (parar de tentar/retomar) em vez de esperar seu próprio timeout.
    if (firebaseDb) {
      if (online) {
        enableNetwork(firebaseDb).catch(() => {});
      } else {
        disableNetwork(firebaseDb).catch(() => {});
      }
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): SyncStatus {
    return { isOnline: this.isOnline };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }
}

export const syncEngine = new ConnectivityMonitor();
