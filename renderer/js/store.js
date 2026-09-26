// ── Data store — Firestore + Firebase Auth ────────────────
//
// Todas as assinaturas de exportação são idênticas à versão JSON/IPC
// anterior, para que as views não precisem ser alteradas.

import { db, auth } from './firebase.js';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch,
} from 'firebase/firestore';
import { responsibleOf } from './utils.js';

let _cache   = {};
let _loading = {};   // leituras em andamento — chamadas simultâneas reaproveitam a mesma
let _gen     = 0;    // invalidação: leitura iniciada antes de um bust() não entra no cache

// ── Low-level ─────────────────────────────────────────────

async function loadCollection(name) {
  if (_cache[name] !== undefined) return _cache[name];
  if (_loading[name]) return _loading[name];

  const gen = _gen;
  const p = getDocs(collection(db, name))
    .then(snap => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (gen === _gen) _cache[name] = data;
      return data;
    })
    .finally(() => { if (_loading[name] === p) delete _loading[name]; });

  _loading[name] = p;
  return p;
}

export function bust(key) {
  _gen++;
  if (key) { delete _cache[key]; delete _loading[key]; }
  else { _cache = {}; _loading = {}; }
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

// Avisa quem acompanha as tarefas (ex.: timer do menu) que algo mudou.
function tasksChanged() {
  bust('tasks');
  window.dispatchEvent(new Event('tasks-changed'));
}

export async function createTask(data) {
  const id = newId(data.type === 'subtask' ? 'sub' : 'task');
  const now = new Date().toISOString();   // mesmo instante: tarefa nova não tem "última atualização"
  const task = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'tasks', id), task);
  tasksChanged();
  return task;
}

export async function updateTask(id, updates) {
  const docRef = doc(db, 'tasks', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error(`Tarefa ${id} não encontrada.`);

  const merged = { ...updates, updatedAt: new Date().toISOString() };
  await updateDoc(docRef, merged);
  tasksChanged();
  return { ...snap.data(), ...merged, id };
}

// Escrita direta, sem leitura prévia — usada pelo timer. A gravação entra na
// fila offline do Firestore na hora, mesmo sem conexão ou com o app fechando.
export async function patchTask(id, fields) {
  await updateDoc(doc(db, 'tasks', id), { ...fields, updatedAt: new Date().toISOString() });
  tasksChanged();
}

export async function deleteTask(id) {
  // Deletar a tarefa e todas as subtarefas (parentId === id)
  const batch = writeBatch(db);
  batch.delete(doc(db, 'tasks', id));

  const subsQuery = query(collection(db, 'tasks'), where('parentId', '==', id));
  const subs = await getDocs(subsQuery);
  subs.forEach(s => batch.delete(s.ref));

  await batch.commit();
  tasksChanged();
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

// ── Controle de acesso por setor ──────────────────────────
// IDs fixos, iguais aos usados em firestore.rules — manter os dois em sincronia.

const ADMIN_SECTOR_ID    = 's4';
const MANAGER_SECTOR_IDS = [ADMIN_SECTOR_ID, 's5'];   // Admin e Gestão

export async function isAdmin(user) {
  return !!user?.sectorIds?.includes(ADMIN_SECTOR_ID);
}

// Setores cujas tarefas ficam ocultas no Backlog para quem não é Admin/Gestão.
export async function getRestrictedSectorIds() {
  return MANAGER_SECTOR_IDS;
}

// Admin ou Gestão: acesso total às tarefas.
export async function isManager(user) {
  return !!user?.sectorIds?.some(s => MANAGER_SECTOR_IDS.includes(s));
}

// Setor da tarefa. Tarefas criadas fora do Backlog não têm `sectorId`:
// usa o primeiro setor do responsável (ou do criador).
export function taskSectorId(task, users) {
  if (task.sectorId) return task.sectorId;
  for (const uid of [responsibleOf(task), task.createdById]) {
    const sid = users.find(u => u.id === uid)?.sectorIds?.find(s => s !== 'ALL');
    if (sid) return sid;
  }
  return null;
}

// Pode editar/excluir: responsável, criador ou Admin/Gestão.
// Sub-tarefas também podem ser editadas por quem gerencia a tarefa pai.
export function canEditTask(task, user, manager, parent = null) {
  if (manager) return true;
  if (!user) return false;   // sem sessão (ex.: caiu enquanto o detalhe abria) → só visualização
  const owns = t => !!t && (t.createdById === user.id || responsibleOf(t) === user.id);
  return owns(task) || owns(parent);
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

// Um tipo atende os setores de uma categoria quando cobre todos eles.
// Categoria "TODOS" só pode usar tipos marcados como "TODOS".
export function typeCoversSectors(type, sectorIds) {
  const ts = type?.sectorIds ?? [];
  if (!sectorIds?.length) return false;
  if (sectorIds.includes('ALL')) return ts.includes('ALL');
  return ts.includes('ALL') || sectorIds.every(s => ts.includes(s));
}

async function assertTypeCoversSectors(activityTypeId, sectorIds) {
  const type = (await getActivityTypes()).find(a => a.id === activityTypeId);
  if (!typeCoversSectors(type, sectorIds))
    throw new Error('O tipo de atividade escolhido não atende todos os setores da categoria.');
}

export async function createCategory({ name, activityTypeId, sectorIds }) {
  await assertActivityTypeExists(activityTypeId);
  const all  = await getCategories();
  const nm   = cleanName(name, 'a categoria');
  const secs = cleanSectorIds(sectorIds);
  await assertTypeCoversSectors(activityTypeId, secs);
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
  await assertTypeCoversSectors(activityTypeId, secs);
  if (all.some(c => c.id !== id &&c.activityTypeId === activityTypeId && norm(c.name) === norm(nm)))
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
