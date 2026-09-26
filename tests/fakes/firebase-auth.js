// Substituto de `firebase/auth` nos testes: contas e sessão em memória.

const auth = { currentUser: null };
let accounts  = new Map();   // email → { uid, password }
let listeners = [];
let nextError = null;
export const authCalls = { signIn: [], signOut: 0, reset: [] };

function authError(code) {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

function notify() {
  listeners.forEach(cb => cb(auth.currentUser));
}

function takeError() {
  const err = nextError;
  nextError = null;
  return err;
}

// ── API usada pelo app ────────────────────────────────────

export function getAuth() {
  return auth;
}

export function connectAuthEmulator() {}

export async function signInWithEmailAndPassword(_auth, email, password) {
  authCalls.signIn.push(email);
  const err = takeError();
  if (err) throw err;
  const acc = accounts.get(email);
  if (!acc || acc.password !== password) throw authError('auth/invalid-credential');
  auth.currentUser = { uid: acc.uid, email };
  notify();
  return { user: auth.currentUser };
}

export async function signOut() {
  authCalls.signOut++;
  auth.currentUser = null;
  notify();
}

export function onAuthStateChanged(_auth, cb) {
  listeners.push(cb);
  queueMicrotask(() => cb(auth.currentUser));   // como o SDK: estado inicial assíncrono
  return () => { listeners = listeners.filter(l => l !== cb); };
}

export async function sendPasswordResetEmail(_auth, email) {
  authCalls.reset.push(email);
  const err = takeError();
  if (err) throw err;
}

// ── Controles para os testes ──────────────────────────────

export function __resetAuth() {
  auth.currentUser = null;
  accounts = new Map();
  listeners = [];
  nextError = null;
  authCalls.signIn = [];
  authCalls.signOut = 0;
  authCalls.reset = [];
}

export function __addAccount({ uid, email, password }) {
  accounts.set(email, { uid, password });
}

// Define a sessão diretamente (sem passar pela tela de login).
export function __setSignedIn(uid, { notifyListeners = false } = {}) {
  auth.currentUser = uid ? { uid, email: `${uid}@teste.local` } : null;
  if (notifyListeners) notify();
}

export function __failNextAuth(code) {
  nextError = authError(code);
}
