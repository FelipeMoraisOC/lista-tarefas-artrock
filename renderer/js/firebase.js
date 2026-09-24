// ── Firebase — inicialização do app, auth e Firestore ─────
//
// Para configurar, substitua os valores de firebaseConfig
// pelos obtidos no Firebase Console → Configurações do projeto → Seus apps.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
} from 'firebase/firestore';

// ── Configuração do projeto Firebase ──────────────────────
// TODO: substituir pelos valores reais do Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCpDpFv6tHLtQkNbHMpYm_YrODxVjsNdL4",
  authDomain: "listatarefasartrock.firebaseapp.com",
  projectId: "listatarefasartrock",
  storageBucket: "listatarefasartrock.firebasestorage.app",
  messagingSenderId: "617873536492",
  appId: "1:617873536492:web:5f7668a62184225d753cc9",
  measurementId: "G-0ZTHZ6YHFR"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Persistência offline (IndexedDB) ──────────────────────
// Permite que o app funcione sem internet — os dados já carregados
// permanecem acessíveis e escritas são enfileiradas até reconectar.
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition')
    console.warn('[Firebase] Persistência offline indisponível — múltiplas abas abertas.');
  else if (err.code === 'unimplemented')
    console.warn('[Firebase] Persistência offline não suportada neste ambiente.');
});

// ── Emuladores locais (descomentar para desenvolvimento local) ─
// connectAuthEmulator(auth, 'http://127.0.0.1:9099');
// connectFirestoreEmulator(db, '127.0.0.1', 8080);
