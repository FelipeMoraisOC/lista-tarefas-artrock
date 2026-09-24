// ── Data store — Firestore + Firebase Auth ────────────────
//
// Todas as assinaturas de exportação são idênticas à versão JSON/IPC
// anterior, para que as views não precisem ser alteradas.

import { db, auth } from './firebase.js';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch,
} from 'firebase/firestore';

let _cache = {};

// ── Low-level ─────────────────────────────────────────────

async function loadCollection(name) {
  if (_cache[name] !== undefined) return _cache[name];
  const snap = await getDocs(collection(db, name));
  const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  _cache[name] = data;
  return data;
}

export function bust(key) {
  if (key) delete _cache[key];
  else _cache = {};
}

// ── Reference data ────────────────────────────────────────

export const getSectors       = () => loadCollection('sectors');
export const getUsers         = () => loadCollection('users');
export const getActivityTypes = () => loadCollection('activityTypes');
export const getCategories    = () => loadCollection('categories');
export const getTasks         = () => loadCollection('tasks');

// ── Session / current user ────────────────────────────────

export async function getCurrentUser() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  if (_cache._currentUser) return _cache._currentUser;
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!snap.exists()) return null;
  const user = { ...snap.data(), id: snap.id };
  _cache._currentUser = user;
  return user;
}

// Mantido para o user-switcher de dev/teste.
// Em produção o user-switcher fica oculto e esta função não é chamada.
export async function setCurrentUser(id) {
  // Buscar o usuário pelo ID (que agora é o UID do Firebase Auth)
  const users = await getUsers();
  const user = users.find(u => u.id === id);
  if (user) {
    _cache._currentUser = user;
  }
}

// ── Filtered getters ──────────────────────────────────────

export async function getActivityTypesForUser(user) {
  const all = await getActivityTypes();
  return all.filter(at =>
    at.sectorIds.includes('ALL') ||
    at.sectorIds.some(s => user.sectorIds.includes(s))
  );
}

export async function getCatsForTypeAndUser(activityTypeId, user) {
  const all = await getCategories();
  return all.filter(c =>
    c.activityTypeId === activityTypeId && (
      c.sectorIds.includes('ALL') ||
      c.sectorIds.some(s => user.sectorIds.includes(s))
    )
  );
}

// ── Task CRUD ─────────────────────────────────────────────

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createTask(data) {
  const id = newId(data.type === 'subtask' ? 'sub' : 'task');
  const task = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'tasks', id), task);
  bust('tasks');
  return task;
}

export async function updateTask(id, updates) {
  const docRef = doc(db, 'tasks', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Tarefa ${id} não encontrada.`);

  const merged = { ...updates, updatedAt: new Date().toISOString() };
  await updateDoc(docRef, merged);
  bust('tasks');
  return { ...snap.data(), ...merged, id };
}

export async function deleteTask(id) {
  // Deletar a tarefa e todas as subtarefas (parentId === id)
  const batch = writeBatch(db);
  batch.delete(doc(db, 'tasks', id));

  const subsQuery = query(collection(db, 'tasks'), where('parentId', '==', id));
  const subs = await getDocs(subsQuery);
  subs.forEach(s => batch.delete(s.ref));

  await batch.commit();
  bust('tasks');
}

// ── User management (admin) ──────────────────────────────

export async function createUser({ uid, email, name, initials, role, sectorIds }) {
  if (!uid?.trim()) throw new Error('UID é obrigatório.');
  if (!email?.trim()) throw new Error('Email é obrigatório.');
  if (!initials?.trim()) throw new Error('Iniciais são obrigatórias.');

  const existing = await getDoc(doc(db, 'users', uid));
  if (existing.exists()) throw new Error(`Já existe um usuário com UID "${uid}".`);

  const user = {
    id: uid,
    email: email.trim(),
    name: (name || '').trim() || email.trim(),
    initials: initials.trim().toUpperCase(),
    role: (role || '').trim() || 'Colaborador',
    sectorIds: sectorIds?.length ? sectorIds : ['ALL'],
  };
  await setDoc(doc(db, 'users', uid), user);
  bust('users');
  return user;
}

export async function updateUser(uid, updates) {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Usuário ${uid} não encontrado.`);

  const merged = { ...updates };
  await updateDoc(docRef, merged);
  bust('users');
  bust('_currentUser');
  return { ...snap.data(), ...merged, id: uid };
}

// ── Admin access (setor "Admin") ──────────────────────────

const ADMIN_SECTOR_NAME = 'admin';

export async function getAdminSector() {
  const sectors = await getSectors();
  return sectors.find(s => (s.name ?? '').trim().toLowerCase() === ADMIN_SECTOR_NAME) ?? null;
}

export async function isAdmin(user) {
  if (!user?.sectorIds) return false;
  const admin = await getAdminSector();
  return !!admin && user.sectorIds.includes(admin.id);
}

// ── Reference data CRUD (admin only) ──────────────────────

const norm = s => String(s ?? '').trim().toLowerCase();

function cleanName(name, label) {
  const v = String(name ?? '').trim();
  if (!v) throw new Error(`Informe o nome d${label}.`);
  return v;
}

function cleanSectorIds(sectorIds) {
  const ids = [...new Set((sectorIds ?? []).filter(Boolean))];
  if (!ids.length) throw new Error('Selecione ao menos um setor.');
  return ids.includes('ALL') ? ['ALL'] : ids;
}

export async function getUsageCounts() {
  const tasks = await getTasks();
  const byActivityType = {};
  const byCategory     = {};
  for (const t of tasks) {
    if (t.activityTypeId) byActivityType[t.activityTypeId] = (byActivityType[t.activityTypeId] ?? 0) + 1;
    if (t.categoryId)     byCategory[t.categoryId]         = (byCategory[t.categoryId]     ?? 0) + 1;
  }
  return { byActivityType, byCategory };
}

// ── Activity types ──

export async function createActivityType({ name, sectorIds }) {
  const all  = await getActivityTypes();
  const nm   = cleanName(name, 'o tipo de atividade');
  const secs = cleanSectorIds(sectorIds);
  if (all.some(a => norm(a.name) === norm(nm)))
    throw new Error(`Já existe um tipo de atividade chamado "${nm}".`);

  const id = newId('at');
  const at = { id, name: nm, sectorIds: secs };
  await setDoc(doc(db, 'activityTypes', id), at);
  bust('activityTypes');
  return at;
}

export async function updateActivityType(id, { name, sectorIds }) {
  const all = await getActivityTypes();
  const i   = all.findIndex(a => a.id === id);
  if (i < 0) throw new Error(`Tipo de atividade ${id} não encontrado.`);

  const nm   = cleanName(name, 'o tipo de atividade');
  const secs = cleanSectorIds(sectorIds);
  if (all.some(a => a.id !== id && norm(a.name) === norm(nm)))
    throw new Error(`Já existe um tipo de atividade chamado "${nm}".`);

  const updated = { ...all[i], name: nm, sectorIds: secs };
  await setDoc(doc(db, 'activityTypes', id), updated);
  bust('activityTypes');
  return updated;
}

export async function deleteActivityType(id) {
  const [all, cats, usage] = await Promise.all([getActivityTypes(), getCategories(), getUsageCounts()]);
  if (!all.some(a => a.id === id)) throw new Error(`Tipo de atividade ${id} não encontrado.`);

  const used = usage.byActivityType[id] ?? 0;
  if (used) throw new Error(`Não é possível excluir: ${used} tarefa(s) usam este tipo de atividade.`);

  const linked = cats.filter(c => c.activityTypeId === id).length;
  if (linked) throw new Error(`Não é possível excluir: ${linked} categoria(s) vinculada(s). Exclua ou mova as categorias primeiro.`);

  await deleteDoc(doc(db, 'activityTypes', id));
  bust('activityTypes');
}

// ── Categories ──

async function assertActivityTypeExists(activityTypeId) {
  if (!activityTypeId) throw new Error('Selecione o tipo de atividade da categoria.');
  const types = await getActivityTypes();
  if (!types.some(a => a.id === activityTypeId))
    throw new Error(`Tipo de atividade ${activityTypeId} não encontrado.`);
}

export async function createCategory({ name, activityTypeId, sectorIds }) {
  await assertActivityTypeExists(activityTypeId);
  const all  = await getCategories();
  const nm   = cleanName(name, 'a categoria');
  const secs = cleanSectorIds(sectorIds);
  if (all.some(c => c.activityTypeId === activityTypeId && norm(c.name) === norm(nm)))
    throw new Error(`Já existe uma categoria "${nm}" neste tipo de atividade.`);

  const id = newId('c');
  const cat = { id, name: nm, activityTypeId, sectorIds: secs };
  await setDoc(doc(db, 'categories', id), cat);
  bust('categories');
  return cat;
}

export async function updateCategory(id, { name, activityTypeId, sectorIds }) {
  const all = await getCategories();
  const i   = all.findIndex(c => c.id === id);
  if (i < 0) throw new Error(`Categoria ${id} não encontrada.`);

  await assertActivityTypeExists(activityTypeId);
  const nm   = cleanName(name, 'a categoria');
  const secs = cleanSectorIds(sectorIds);
  if (all.some(c => c.id !== id && c.activityTypeId === activityTypeId && norm(c.name) === norm(nm)))
    throw new Error(`Já existe uma categoria "${nm}" neste tipo de atividade.`);

  const updated = { ...all[i], name: nm, activityTypeId, sectorIds: secs };
  await setDoc(doc(db, 'categories', id), updated);
  bust('categories');
  return updated;
}

export async function deleteCategory(id) {
  const [all, usage] = await Promise.all([getCategories(), getUsageCounts()]);
  if (!all.some(c => c.id === id)) throw new Error(`Categoria ${id} não encontrada.`);

  const used = usage.byCategory[id] ?? 0;
  if (used) throw new Error(`Não é possível excluir: ${used} tarefa(s) usam esta categoria.`);

  await deleteDoc(doc(db, 'categories', id));
  bust('categories');
}
