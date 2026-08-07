import { getSyncQueue, clearSyncQueueItem, putCustomerLocal, putCategoryLocal, putProductLocal, putQuoteLocal, putCompanySettingsLocal } from './db';
import { db as firebaseDb, ensureFirebaseAuth } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

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
    window.addEventListener('online', () => this.checkConnectivity());
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    
    // Initial check and periodic heartbeat check every 4 seconds
    this.checkConnectivity();
    setInterval(() => this.checkConnectivity(), 4000);
  }

  public async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      this.handleNetworkChange(false);
      return false;
    }

    try {
      // Use controller with 2.5 second timeout for quick detection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`/favicon.ico?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const online = res.ok || res.status < 500;
      this.handleNetworkChange(online);
      return online;
    } catch {
      // Fetch failed -> No internet connectivity
      this.handleNetworkChange(false);
      return false;
    }
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
    const stateChanged = this.isOnline !== online;
    this.isOnline = online;
    if (stateChanged) {
      this.notify();
      if (online) {
        this.syncNow();
      }
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
      // Garante sessão anônima no Firebase antes de gravar no Firestore
      // (necessário para regras de segurança que exigem request.auth != null)
      await ensureFirebaseAuth();

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

// ---------------------------------------------------------------------------
// Puxa os dados do tenant do Firestore (nuvem) para o IndexedDB local.
// ---------------------------------------------------------------------------
// Necessário porque, sem isso, cada navegador/dispositivo/aba anônima começa com o
// IndexedDB vazio e nunca "vê" os orçamentos criados em outro lugar — o sync antigo
// só enviava dados locais PARA a nuvem, nunca buscava de volta. Chamado no login
// (ver authContext.tsx) para trazer o histórico existente para o dispositivo atual.
export async function pullTenantDataFromCloud(tenantId: string): Promise<{ pulled: number; error?: string }> {
  if (!firebaseDb) return { pulled: 0 };

  try {
    await ensureFirebaseAuth();

    let pulled = 0;

    const collections: Array<{ name: string; put: (data: any) => Promise<void> }> = [
      { name: 'customers', put: putCustomerLocal },
      { name: 'categories', put: putCategoryLocal },
      { name: 'products', put: putProductLocal },
      { name: 'quotes', put: putQuoteLocal },
      { name: 'settings', put: putCompanySettingsLocal },
    ];

    for (const c of collections) {
      const snap = await getDocs(collection(firebaseDb, 'tenants', tenantId, c.name));
      for (const docSnap of snap.docs) {
        await c.put(docSnap.data());
        pulled++;
      }
    }

    return { pulled };
  } catch (err: any) {
    console.warn('Falha ao puxar dados do Firestore para este dispositivo:', err?.message);
    return { pulled: 0, error: err?.message };
  }
}
