/// <reference types="vite/client" />
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';

// Fallback configuration if env vars are not yet set
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);

  // O Firestore é a ÚNICA fonte de dados do app (sem banco local próprio reinventado).
  // Para funcionar offline mesmo assim, usamos o cache local PERSISTENTE nativo do
  // próprio Firestore: ele guarda os dados em IndexedDB por baixo dos panos, enfileira
  // escritas feitas offline automaticamente, e sincroniza sozinho assim que a conexão
  // volta — sem precisarmos manter nossa própria fila de sincronização (que é onde os
  // bugs de "não aparece em outro aparelho" viviam). `persistentMultipleTabManager`
  // permite abrir o sistema em várias abas/dispositivos ao mesmo tempo sem conflito.
  //
  // IMPORTANTE: aponta explicitamente para o banco de dados chamado "default" — se o
  // banco do Firestore foi criado como um banco nomeado literalmente "default" (em vez
  // do banco reservado especial que o SDK usa por padrão quando nenhum nome é
  // informado), isso resolve o erro "Database '(default)' not found".
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      // O Firestore, ao contrário do antigo IndexedDB, RECUSA gravar qualquer campo
      // com valor `undefined` (erro "Unsupported field value: undefined"). Como o
      // app tem vários campos opcionais (ex: depositDate, notes, cardFeePercent)
      // que ficam undefined quando não preenchidos, isso quebrava toda gravação de
      // orçamento. Esta opção faz o Firestore simplesmente ignorar esses campos,
      // igual o comportamento anterior.
      ignoreUndefinedProperties: true,
    },
    'default'
  );
} catch (error) {
  console.warn("Firebase initialization warning:", error);
}

// Aguarda a sessão real do Firebase Authentication (e-mail/senha) estar pronta antes de
// qualquer leitura/escrita no Firestore. O UID dessa sessão é o mesmo usado como `tenantId`
// em todo o app, o que permite regras de segurança do tipo:
//   allow read, write: if request.auth != null && request.auth.uid == tenantId;
// garantindo isolamento real de dados entre vidraçarias diferentes (multi-tenant SaaS).
export function ensureFirebaseAuth(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(), 5000);
    const unsubscribe = (auth as Auth).onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
}

export { app, auth, db };
