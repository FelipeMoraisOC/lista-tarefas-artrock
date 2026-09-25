// ── Timer das tarefas em andamento (menu lateral) ─────────
//
// Lista as tarefas "Em Andamento" do usuário logado. A tarefa do topo é a
// que conta tempo: arrastar uma tarefa para o topo troca a tarefa ativa, e
// arrastar para acima da lista (zona "Concluir") conclui a tarefa.
//
// Fonte da verdade: `hoursInvested`. Enquanto roda, o total da tarefa ativa
// é baseSec + (agora − segStart). Toda gravação envia o valor ABSOLUTO —
// repetir uma gravação nunca soma tempo em dobro.
//
// Grava no Firebase ao: pausar, trocar a tarefa ativa, concluir, adicionar
// tempo, salvar/fechar o detalhe da tarefa ativa, sair da conta e fechar o
// app. No resto do tempo, o estado fica só no localStorage.
//
// Proteções:
// - estado salvo localmente a cada segundo → recarregar não perde tempo;
// - app fechado com o timer rodando → ao reabrir, credita até o último
//   segundo registrado e pausa;
// - computador suspenso (5+ min sem batimento) → pausa e credita só até
//   antes da suspensão;
// - gravações não confirmadas (offline) ficam pendentes e são refeitas.

import { getTasks, patchTask } from '../store.js';
import { showToast, formatDuration, responsibleOf, todayISO } from '../utils.js';

const TICK_MS        = 1000;
const RESUME_GAP_MS  = 2 * 60 * 1000;  // reabriu em até 2 min (ex.: recarregar/atualizar) → continua
const SLEEP_GAP_MS   = 5 * 60 * 1000;  // sem batimento por 5+ min com o app aberto → suspensão
const FLUSH_WAIT_MS  = 3000;           // espera máxima pelas gravações ao fechar/sair
const DRAG_START_PX  = 5;
const DONE_ZONE_PX   = 24;             // quanto acima da lista o ponteiro precisa ir para concluir
const ADD_MINUTES    = [5, 10, 15, 30];
const STORAGE_PREFIX = 'artrock:timer:';

const toSec   = h => Math.round((h ?? 0) * 3600);
const toHours = s => Math.round((s / 3600) * 1e6) / 1e6;
const hhmm    = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const ICONS = {
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  play:  'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  eye:   'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
};
const icon = (name, size = 14) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}"><path d="${ICONS[name]}"/></svg>`;

// ── Estado ────────────────────────────────────────────────

const idleState = () => ({
  running: false, activeId: null, activeName: '',
  baseSec: 0, savedSec: 0, segStart: 0, lastBeat: 0,
});

let user     = null;
let hooks    = {};
let st       = idleState();
let tasks    = [];            // tarefas em andamento, na ordem da lista
let order    = [];            // ids na ordem escolhida pelo usuário
let existing = new Set();     // ids de todas as tarefas (para ignorar excluídas)
let pending  = {};            // taskId → campos ainda não confirmados pelo Firebase
const known    = new Map();   // taskId → { sec, at } gravados/sincronizados nesta sessão
const inflight = new Set();
const tickListeners = new Set();

let tickHandle = null;
let reloadSeq  = 0;
let drag       = null;
let staleDom   = false;       // dados mudaram durante um arraste → renderizar ao soltar
let menu       = null;
let bound      = false;

const panel    = () => document.getElementById('task-timer');
const isActive = id => st.running && st.activeId === id;

function liveSec(now = Date.now()) {
  return st.baseSec + Math.max(0, now - st.segStart) / 1000;
}

function displaySec(task) {
  return isActive(task.id) ? liveSec() : toSec(task.hoursInvested);
}

// ── Persistência local ────────────────────────────────────

function storageKey() {
  return `${STORAGE_PREFIX}${user.id}`;
}

function persist() {
  if (!user) return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ st, order, pending }));
  } catch { /* sem storage: segue só em memória */ }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) ?? 'null');
    if (!saved) return;
    st      = { ...idleState(), ...saved.st };
    order   = Array.isArray(saved.order) ? saved.order : [];
    pending = saved.pending ?? {};
  } catch { /* estado corrompido: começa do zero */ }
}

// ── Gravação no Firebase ──────────────────────────────────

function send(taskId, fields) {
  const merged = { ...(pending[taskId] ?? {}), ...fields };
  pending[taskId] = merged;
  persist();

  const p = patchTask(taskId, fields)
    .then(() => {
      if (pending[taskId] === merged) { delete pending[taskId]; persist(); }
    })
    .catch(err => {
      console.error('[timer] Falha ao salvar', taskId, err);
      if (err.code === 'not-found' || err.code === 'permission-denied') {
        delete pending[taskId];
        persist();
      }
      if (err.code !== 'not-found') {
        showToast(`Não foi possível salvar o tempo da tarefa: ${esc(err.message)}`, 'error');
      }
    });

  inflight.add(p);
  p.finally(() => inflight.delete(p));
  return p;
}

// Grava o total absoluto de segundos (e campos extras) de uma tarefa.
function writeHours(taskId, sec, extra = {}) {
  const fields = { hoursInvested: toHours(sec), ...extra };
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    // Primeiro registro de tempo marca o início da tarefa
    if (!task.startDate && !('startDate' in extra)) fields.startDate = todayISO();
    Object.assign(task, fields);
  }
  known.set(taskId, { sec, at: Date.now() });
  return send(taskId, fields);
}

// Fecha o trecho em andamento da tarefa ativa e grava o total, se mudou.
function commitActive() {
  if (!st.running || !st.activeId) return null;
  const now = Date.now();
  const sec = liveSec(now);
  st.baseSec  = sec;
  st.segStart = now;
  st.lastBeat = now;

  let p = null;
  if (sec - st.savedSec >= 1) {
    st.savedSec = sec;
    if (!existing.size || existing.has(st.activeId)) p = writeHours(st.activeId, sec);
  }
  persist();
  return p;
}

function waitInflight() {
  return Promise.race([
    Promise.allSettled([...inflight]),
    new Promise(resolve => setTimeout(resolve, FLUSH_WAIT_MS)),
  ]);
}

// ── Controle ──────────────────────────────────────────────

function beginSegment(task) {
  const now = Date.now();
  st.activeId   = task.id;
  st.activeName = task.name;
  st.baseSec    = st.savedSec = toSec(task.hoursInvested);
  st.segStart   = st.lastBeat = now;
}

function start() {
  if (!tasks[0]) return;
  beginSegment(tasks[0]);
  st.running = true;
  persist();
  render();
}

function pause() {
  if (!st.running) return;
  commitActive();
  st = idleState();
  persist();
  render();
}

// Pausa creditando o tempo só até `until` (suspensão ou app fechado).
function pauseAt(until) {
  const sec  = liveSec(until);
  const id   = st.activeId;
  const name = st.activeName;
  const changed = sec - st.savedSec >= 1;
  st = idleState();
  persist();
  if (changed && (!existing.size || existing.has(id))) writeHours(id, sec);
  render();
  return name;
}

// A tarefa do topo é sempre a que conta tempo enquanto o timer roda.
function reconcile() {
  if (!st.running) return;
  const top = tasks[0];
  if (top?.id === st.activeId) { st.activeName = top.name; return; }

  commitActive();                       // grava a tarefa que saiu do topo
  if (top) {
    beginSegment(top);
  } else {
    st = idleState();
    showToast('Timer pausado: não há mais tarefas em andamento.', 'info');
  }
  persist();
}

function applyOrder(ids) {
  order = [...ids.filter(id => order.includes(id)), ...order.filter(id => !ids.includes(id))];
  tasks = order.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  reconcile();
  persist();
  render();
}

function addTime(taskId, minutes) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (isActive(taskId)) {
    st.baseSec += minutes * 60;
    commitActive();
  } else {
    writeHours(taskId, toSec(task.hoursInvested) + minutes * 60);
  }
  render();
  showToast(`+${minutes} min em "${esc(task.name)}".`, 'success');
}

function completeTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const active = isActive(taskId);
  const sec    = active ? liveSec() : toSec(task.hoursInvested);
  const index  = order.indexOf(taskId);
  const prev   = {
    status: task.status,
    startDate: task.startDate ?? null,
    endDate: task.endDate ?? null,
    completionPercent: task.completionPercent ?? 0,
  };
  const today = todayISO();

  const saved = writeHours(taskId, sec, {
    status: 'Concluído',
    startDate: task.startDate || today,
    endDate: task.endDate || today,
    completionPercent: 100,
  });

  order = order.filter(id => id !== taskId);
  tasks = tasks.filter(t => t.id !== taskId);
  if (active) {
    if (tasks[0]) beginSegment(tasks[0]);
    else st = idleState();
  }
  persist();
  render();
  saved.then(() => hooks.onDataChanged?.());

  const next = active && tasks[0] ? ` O timer seguiu para "${esc(tasks[0].name)}".` : '';
  showToast(`"${esc(task.name)}" concluída.${next}`, 'success', {
    duration: 7000,
    action: { label: 'Desfazer', onClick: () => undoComplete(taskId, index, prev) },
  });
}

function undoComplete(taskId, index, prev) {
  if (!user) return;
  const saved = send(taskId, prev);     // as horas continuam as já gravadas
  order = order.filter(id => id !== taskId);
  order.splice(Math.min(index, order.length), 0, taskId);
  persist();
  reload();                             // se voltou ao topo, o timer volta para ela
  saved.then(() => hooks.onDataChanged?.());
}

async function openTask(id) {
  const fresh = (await getTasks()).find(t => t.id === id) ?? tasks.find(t => t.id === id);
  if (!fresh) return;
  const { openTaskDetail } = await import('../views/modals.js');
  openTaskDetail({ ...fresh, ...(pending[id] ?? {}) }, () => hooks.onDataChanged?.());
}

// ── Dados ─────────────────────────────────────────────────

async function reload() {
  if (!user) return;
  const seq = ++reloadSeq;

  let all;
  try {
    all = await getTasks();
  } catch (err) {
    console.error('[timer] Falha ao carregar tarefas', err);
    return;
  }
  if (seq !== reloadSeq || !user) return;

  existing = new Set(all.map(t => t.id));

  // Gravações ainda não confirmadas valem sobre o que veio do cache
  const mine = all
    .filter(t => t.type === 'task' && responsibleOf(t) === user.id)
    .map(t => ({ ...t, ...(pending[t.id] ?? {}) }))
    .filter(t => t.status === 'Em Andamento');

  const ids = new Set(mine.map(t => t.id));
  order = order.filter(id => ids.has(id));
  mine.forEach(t => { if (!order.includes(t.id)) order.push(t.id); });   // novas vão para o fim
  tasks = order.map(id => mine.find(t => t.id === id));

  reconcile();
  persist();
  if (drag) staleDom = true;
  else render();
}

const onTasksChanged = () => reload();

// ── Batimento (1s) ────────────────────────────────────────

function tick() {
  const now = Date.now();

  if (st.running) {
    if (now < st.lastBeat) {
      // Relógio do sistema voltou: mantém o total e recomeça o trecho
      st.baseSec  = liveSec(st.lastBeat);
      st.segStart = now;
    } else if (now - st.lastBeat > SLEEP_GAP_MS) {
      const since = st.lastBeat;
      const name  = pauseAt(since);
      showToast(`Timer de "${esc(name)}" pausado: o computador ficou inativo. Tempo registrado até ${hhmm(since)}.`, 'info', { duration: 9000 });
    }
    if (st.running) {
      st.lastBeat = now;
      persist();
    }
  }

  updateTimes();
  tickListeners.forEach(cb => {
    try { cb(); } catch (err) { console.error('[timer] tick listener', err); }
  });
}

// ── Render ────────────────────────────────────────────────

function render() {
  const root = panel();
  if (!root) return;
  root.classList.toggle('hidden', !user);
  if (!user) { root.innerHTML = ''; return; }

  const has = tasks.length > 0;
  root.innerHTML = `
    <div class="tt-head">
      <span class="tt-title">${icon('clock')} Em andamento</span>
      <span class="tt-count">${tasks.length}</span>
      <div class="tt-done-zone">${icon('check')} Solte para concluir</div>
    </div>

    <div class="tt-list" role="list">
      ${has ? tasks.map((t, i) => `
        <div class="tt-item${i === 0 ? ' is-top' : ''}${isActive(t.id) ? ' is-running' : ''}"
             data-id="${t.id}" role="listitem" tabindex="0" title="${esc(t.name)}">
          <span class="tt-dot"></span>
          <span class="tt-name">${esc(t.name)}</span>
          <span class="tt-time" data-time="${t.id}">${formatDuration(displaySec(t))}</span>
        </div>`).join('')
      : '<div class="tt-empty">Nenhuma tarefa em andamento.</div>'}
    </div>

    <div class="tt-controls">
      <button type="button" class="tt-btn tt-btn-play${st.running ? ' is-running' : ''}" id="tt-toggle" ${has ? '' : 'disabled'}>
        ${st.running ? `${icon('pause')} Pausar` : `${icon('play')} Iniciar`}
      </button>
      <button type="button" class="tt-btn" id="tt-view" ${has ? '' : 'disabled'} title="Abrir os detalhes da tarefa ativa">
        ${icon('eye')} Ver ativa
      </button>
    </div>
    ${tasks.length > 1 ? '<div class="tt-hint">Arraste para o topo para trocar a tarefa ativa, ou acima da lista para concluir.</div>' : ''}
  `;
}

function updateTimes() {
  if (!st.running) return;
  const el = panel()?.querySelector(`[data-time="${st.activeId}"]`);
  if (el) el.textContent = formatDuration(liveSec());
}

// ── Arrastar (pointer events) ─────────────────────────────

function onPointerDown(e) {
  if (e.button !== 0) return;
  const item = e.target.closest('.tt-item');
  if (!item) return;
  const items = [...panel().querySelectorAll('.tt-item')];
  drag = {
    item, items, id: item.dataset.id, from: items.indexOf(item),
    startY: e.clientY, pointerId: e.pointerId, started: false, to: null, toDone: false,
  };
  item.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dy = e.clientY - drag.startY;

  if (!drag.started) {
    if (Math.abs(dy) < DRAG_START_PX) return;
    drag.started = true;
    panel().classList.add('is-dragging');       // antes de medir: muda o overflow da lista
    drag.item.classList.add('is-dragged');
    drag.rects   = drag.items.map(el => el.getBoundingClientRect());
    drag.slot    = drag.rects.length > 1 ? drag.rects[1].top - drag.rects[0].top : drag.rects[0].height;
    drag.listTop = panel().querySelector('.tt-list').getBoundingClientRect().top;
    closeMenu();
  }

  drag.dy = dy;
  drag.item.style.transform = `translateY(${dy}px)`;

  const r      = drag.rects[drag.from];
  const center = r.top + r.height / 2 + dy;
  drag.toDone  = e.clientY < drag.listTop - DONE_ZONE_PX;

  let to = 0;
  drag.rects.forEach((rc, i) => {
    if (i !== drag.from && center > rc.top + rc.height / 2) to++;
  });
  drag.to = drag.toDone ? drag.from : to;

  drag.items.forEach((el, i) => {
    if (i === drag.from) return;
    let shift = 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -drag.slot;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) shift = drag.slot;
    el.style.transform = shift ? `translateY(${shift}px)` : '';
  });

  panel().classList.toggle('is-over-done', drag.toDone);
}

function endDrag() {
  panel()?.classList.remove('is-dragging', 'is-over-done');
  const wasStale = staleDom;
  staleDom = false;
  return wasStale;
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;

  if (!d.started) { openTask(d.id); return; }   // clique simples → detalhes
  const stale = endDrag();

  if (d.toDone) {
    const task = tasks.find(t => t.id === d.id);
    if (!task || displaySec(task) < 1) {
      showToast('Registre algum tempo nesta tarefa antes de concluí-la.', 'error');
      render();
      return;
    }
    d.item.style.setProperty('--tt-y', `${d.dy}px`);   // a animação parte de onde foi solta
    d.item.style.transform = '';
    d.item.classList.add('is-completing');
    setTimeout(() => completeTask(d.id), 420);
    return;
  }

  if (d.to !== d.from) {
    const ids = d.items.map(el => el.dataset.id);
    const [moved] = ids.splice(d.from, 1);
    ids.splice(d.to, 0, moved);
    applyOrder(ids);                    // se o topo mudou, grava a anterior e troca
  } else if (stale) {
    render();
  } else {
    d.items.forEach(el => { el.style.transform = ''; });
    d.item.classList.remove('is-dragged');
  }
}

function onPointerCancel(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag = null;
  endDrag();
  render();
}

// ── Menu do botão direito ─────────────────────────────────

function onContextMenu(e) {
  const item = e.target.closest('.tt-item');
  if (!item) return;
  e.preventDefault();
  closeMenu();

  const id = item.dataset.id;
  menu = document.createElement('div');
  menu.className = 'tt-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <div class="tt-menu-title">Adicionar tempo</div>
    ${ADD_MINUTES.map(m => `<button type="button" class="tt-menu-item" role="menuitem" data-add="${m}">+ ${m} min</button>`).join('')}
    <div class="tt-menu-sep"></div>
    <button type="button" class="tt-menu-item" role="menuitem" data-open>Abrir detalhes</button>`;
  document.body.appendChild(menu);

  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - r.width - 8)}px`;
  menu.style.top  = `${Math.min(e.clientY, window.innerHeight - r.height - 8)}px`;

  menu.addEventListener('click', ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    closeMenu();
    if (btn.dataset.add) addTime(id, Number(btn.dataset.add));
    else openTask(id);
  });
  menu.querySelector('button')?.focus();

  document.addEventListener('pointerdown', onOutsideMenu, true);
  document.addEventListener('keydown', onMenuKey, true);
  window.addEventListener('blur', closeMenu);
}

function onOutsideMenu(e) {
  if (menu && !menu.contains(e.target)) closeMenu();
}

function onMenuKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
}

function closeMenu() {
  if (!menu) return;
  menu.remove();
  menu = null;
  document.removeEventListener('pointerdown', onOutsideMenu, true);
  document.removeEventListener('keydown', onMenuKey, true);
  window.removeEventListener('blur', closeMenu);
}

// ── Eventos do painel (ligados uma vez) ───────────────────

function bindPanel() {
  const root = panel();
  if (!root || bound) return;
  bound = true;

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('contextmenu', onContextMenu);

  root.addEventListener('click', e => {
    if (e.target.closest('#tt-toggle')) st.running ? pause() : start();
    if (e.target.closest('#tt-view') && tasks[0]) openTask(tasks[0].id);
  });

  root.addEventListener('keydown', e => {
    const item = e.target.closest('.tt-item');
    if (item && e.key === 'Enter') openTask(item.dataset.id);
  });
}

// ═══════════════════════════════════════════════════════════
// API pública
// ═══════════════════════════════════════════════════════════

// Inicia o timer para o usuário logado. `hookFns.onDataChanged` é chamado
// quando o timer muda o status de uma tarefa ou o detalhe aberto por ele salva.
export async function initTaskTimer(currentUser, hookFns = {}) {
  teardownTaskTimer();
  user  = currentUser;
  hooks = hookFns;
  load();
  bindPanel();

  // Gravações que não chegaram ao Firebase na última sessão
  Object.entries(pending).forEach(([id, fields]) => send(id, fields));

  // App ficou fechado com o timer rodando: credita até o último batimento
  if (st.running && Date.now() - st.lastBeat > RESUME_GAP_MS) {
    const since = st.lastBeat;
    const name  = pauseAt(since);
    showToast(`Timer de "${esc(name)}" pausado porque o app foi fechado. Tempo registrado até ${hhmm(since)}.`, 'info', { duration: 9000 });
  }

  render();
  window.addEventListener('tasks-changed', onTasksChanged);
  tickHandle = setInterval(tick, TICK_MS);
  await reload();
}

export function teardownTaskTimer() {
  clearInterval(tickHandle);
  tickHandle = null;
  window.removeEventListener('tasks-changed', onTasksChanged);
  closeMenu();
  drag = null;
  user = null;
  st = idleState();
  tasks = [];
  order = [];
  pending = {};
  existing = new Set();
  known.clear();
  tickListeners.clear();
  reloadSeq++;
  render();
}

// Fechar o app: grava o tempo e espera o Firebase (com limite).
// O timer continua "rodando" no estado local: se o app reabrir em até
// 2 minutos (ex.: atualização), segue contando; depois disso, pausa.
export async function flushTaskTimer() {
  if (!user) return;
  closeMenu();
  commitActive();
  await waitInflight();
}

// Sair da conta: pausa, grava e desliga o timer.
export async function stopTaskTimer() {
  if (!user) return;
  pause();
  await waitInflight();
  teardownTaskTimer();
}

// Horas da tarefa segundo o timer: ao vivo (se ativa) ou o último valor que
// o timer gravou depois de `since`. `null` quando o timer não sabe de nada novo.
export function timerHoursFor(taskId, since = 0) {
  if (isActive(taskId)) return { hours: toHours(liveSec()), at: Date.now(), live: true };
  const k = known.get(taskId);
  return k && k.at > since ? { hours: toHours(k.sec), at: k.at, live: false } : null;
}

// O detalhe da tarefa gravou `hours` (medido em `at`): o timer passa a contar a partir daí.
export function syncTimerHours(taskId, hours, at = Date.now()) {
  if (!user) return;
  const sec = toSec(hours);
  known.set(taskId, { sec, at });

  if (pending[taskId]) {
    const { hoursInvested, ...rest } = pending[taskId];
    if (Object.keys(rest).length) pending[taskId] = rest;
    else delete pending[taskId];
  }

  const task = tasks.find(t => t.id === taskId);
  if (task) task.hoursInvested = hours ?? null;

  if (isActive(taskId)) {
    st.baseSec  = st.savedSec = sec;
    st.segStart = at;
  }
  persist();
  render();
}

// Fechar o detalhe da tarefa ativa também grava o tempo.
export function commitTimerIfActive(taskId) {
  if (isActive(taskId)) commitActive();
}

// Assina o batimento de 1s (ex.: atualizar as horas no detalhe). Retorna o cancelamento.
export function onTimerTick(cb) {
  tickListeners.add(cb);
  return () => tickListeners.delete(cb);
}
