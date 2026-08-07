/// <reference types="vite/client" />
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

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
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase initialization warning (operating in local IndexedDB mode):", error);
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
