import { getSyncQueue, clearSyncQueueItem } from './db';
import { db as firebaseDb } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  errorMessage: string | null;
}

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private lastSyncTime: Date | null = null;
  private errorMessage: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private tenantId: string = 'tenant_default';

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  public setTenantId(tenantId: string) {
    this.tenantId = tenantId;
    this.updatePendingCount();
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime,
      errorMessage: this.errorMessage,
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notify();
    if (online) {
      this.syncNow();
    }
  }

  public async updatePendingCount() {
    try {
      const queue = await getSyncQueue(this.tenantId);
      this.pendingCount = queue.length;
      this.notify();
    } catch (e) {
      console.error('Error fetching sync queue size', e);
    }
  }

  public async syncNow() {
    if (!this.isOnline || this.isSyncing) return;
    this.isSyncing = true;
    this.errorMessage = null;
    this.notify();

    try {
      const queue = await getSyncQueue(this.tenantId);
      this.pendingCount = queue.length;

      for (const item of queue) {
        if (firebaseDb) {
          try {
            // Document path: tenants/{tenantId}/{collection}/{docId}
            const docRef = doc(firebaseDb, 'tenants', this.tenantId, item.collection, item.data.id || item.data.tenantId);
            if (item.action === 'CREATE' || item.action === 'UPDATE') {
              await setDoc(docRef, { ...item.data, syncedAt: new Date().toISOString() }, { merge: true });
            } else if (item.action === 'DELETE') {
              await deleteDoc(docRef);
            }
          } catch (err: any) {
            console.warn(`Firestore sync item skipped or operating in offline fallback mode:`, err?.message);
          }
        }
        // Remove item from local queue after processing
        await clearSyncQueueItem(item.id);
      }

      this.lastSyncTime = new Date();
      this.pendingCount = 0;
    } catch (err: any) {
      this.errorMessage = err?.message || 'Erro ao sincronizar dados';
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.notify();
    }
  }
}

export const syncEngine = new SyncEngine();
