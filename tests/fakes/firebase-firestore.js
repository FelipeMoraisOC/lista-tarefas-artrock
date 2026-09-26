// Substituto de `firebase/firestore` nos testes: banco em memória.
//
// Implementa só o que o app usa (store.js e firebase.js). Os dados são
// copiados na entrada e na saída — como no Firestore, alterar o objeto
// retornado não altera o "banco".
//
// Simula também o que importa para o app:
// - offline: a escrita vale localmente na hora, mas a Promise só termina
//   quando a conexão volta (igual ao SDK com persistência);
// - falhas: a próxima chamada de uma operação pode falhar com um `code`
//   (ex.: 'permission-denied', 'not-found');
// - leituras seguradas: para testar corridas do cache.

const DB = { __fake: 'firestore' };

let data      = new Map();   // coleção → Map(id → documento)
let failures  = [];          // [{ op, error }]
let offline   = false;
let queue     = [];          // resoluções de escritas feitas offline
let heldReads = null;

export const stats = { getDocs: [], getDoc: 0, writes: [] };

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function fsError(code, message) {
  return Object.assign(new Error(message ?? `Firestore (fake): ${code}`), { code });
}

function coll(name) {
  if (!data.has(name)) data.set(name, new Map());
  return data.get(name);
}

function takeFailure(op) {
  const i = failures.findIndex(f => f.op === op);
  return i < 0 ? null : failures.splice(i, 1)[0].error;
}

function snapshot(name, id, stored) {
  return {
    id,
    ref: { kind: 'doc', collection: name, id },
    exists: () => stored !== undefined,
    data: () => clone(stored),
  };
}

function matches(stored, { field, op, value }) {
  const v = stored[field];
  if (op === '==') return v === value;
  if (op === '!=') return v !== value;
  if (op === 'in') return value.includes(v);
  throw new Error(`Operador não suportado no fake do Firestore: ${op}`);
}

function write(op, ref, apply, payload) {
  stats.writes.push({ op, collection: ref.collection, id: ref.id, data: clone(payload) });
  const err = takeFailure(op);
  if (err) return Promise.reject(err);
  try { apply(); } catch (e) { return Promise.reject(e); }
  if (!offline) return Promise.resolve();
  return new Promise(resolve => queue.push(resolve));   // confirma quando voltar a conexão
}

// ── API usada pelo app ────────────────────────────────────

export function getFirestore() { return DB; }
export function connectFirestoreEmulator() {}
export function enableIndexedDbPersistence() { return Promise.resolve(); }

export function collection(_db, name) { return { kind: 'collection', name }; }
export function doc(_db, name, id) { return { kind: 'doc', collection: name, id }; }
export function where(field, op, value) { return { field, op, value }; }
export function query(ref, ...constraints) { return { kind: 'query', name: ref.name, constraints }; }

export async function getDocs(ref) {
  stats.getDocs.push(ref.kind === 'query' ? `${ref.name}(query)` : ref.name);
  const err = takeFailure('getDocs');
  if (err) throw err;
  if (heldReads) await heldReads;
  let entries = [...coll(ref.name).entries()];
  if (ref.kind === 'query') entries = entries.filter(([, d]) => ref.constraints.every(c => matches(d, c)));
  const docs = entries.map(([id, d]) => snapshot(ref.name, id, d));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: fn => docs.forEach(fn) };
}

export async function getDoc(ref) {
  stats.getDoc++;
  const err = takeFailure('getDoc');
  if (err) throw err;
  return snapshot(ref.collection, ref.id, coll(ref.collection).get(ref.id));
}

export function setDoc(ref, value) {
  return write('setDoc', ref, () => coll(ref.collection).set(ref.id, clone(value)), value);
}

export function updateDoc(ref, value) {
  return write('updateDoc', ref, () => {
    const c = coll(ref.collection);
    if (!c.has(ref.id)) throw fsError('not-found', `No document to update: ${ref.collection}/${ref.id}`);
    c.set(ref.id, { ...c.get(ref.id), ...clone(value) });
  }, value);
}

export function deleteDoc(ref) {
  return write('deleteDoc', ref, () => coll(ref.collection).delete(ref.id));
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, value) { ops.push({ op: 'set', ref, value }); return this; },
    update(ref, value) { ops.push({ op: 'update', ref, value }); return this; },
    delete(ref) { ops.push({ op: 'delete', ref }); return this; },
    async commit() {
      stats.writes.push({ op: 'batch', items: ops.map(o => ({ op: o.op, collection: o.ref.collection, id: o.ref.id })) });
      const err = takeFailure('batch');
      if (err) throw err;
      ops.forEach(({ op, ref, value }) => {
        const c = coll(ref.collection);
        if (op === 'delete') c.delete(ref.id);
        else if (op === 'set') c.set(ref.id, clone(value));
        else c.set(ref.id, { ...c.get(ref.id), ...clone(value) });
      });
    },
  };
}

// ── Controles para os testes ──────────────────────────────

export function __reset() {
  data = new Map();
  failures = [];
  offline = false;
  queue = [];
  heldReads = null;
  stats.getDocs = [];
  stats.getDoc = 0;
  stats.writes = [];
}

export function __seed(name, docs) {
  const c = coll(name);
  docs.forEach(d => c.set(d.id, clone(d)));
}

export function __doc(name, id) {
  return clone(coll(name).get(id));
}

export function __all(name) {
  return [...coll(name).values()].map(clone);
}

// Próxima chamada de `op` ('getDocs', 'getDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'batch') falha.
export function __failNext(op, code, message) {
  failures.push({ op, error: fsError(code, message) });
}

export function __setOffline(value) {
  offline = value;
  if (!value) {
    const pending = queue;
    queue = [];
    pending.forEach(resolve => resolve());
  }
}

export function __pendingWrites() {
  return queue.length;
}

// Segura as próximas leituras (getDocs) até chamar a função devolvida.
export function __holdReads() {
  let release;
  heldReads = new Promise(r => { release = r; });
  return () => { heldReads = null; release(); };
}

// Escritas feitas numa coleção (opcionalmente só de um tipo de operação).
export function __writes(collectionName, op) {
  return stats.writes.filter(w => w.collection === collectionName && (!op || w.op === op));
}
