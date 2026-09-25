// ── Backlog — tarefas de todos os setores ─────────────────
//
// Setores → tipos de atividade (com contagem) → tabela de tarefas.
// Tarefas dos setores Admin e Gestão só aparecem para quem é desses
// setores ou para quem criou a tarefa.

import {
  getTasks, getUsers, getSectors, getActivityTypes, getCategories,
  getCurrentUser, isManager, getRestrictedSectorIds, taskSectorId,
} from '../store.js';
import { openCreateTask, openTaskDetail, esc, icon } from './modals.js';
import { formatDate, isOverdue, responsibleOf } from '../utils.js';

const NO_SECTOR = '__none';
const ALL_TYPES = '__all';

const STATUS_OPTS = ['Para Fazer', 'Em Andamento', 'Concluído'];
const slug = s => String(s ?? '').toLowerCase().replace(/ /g, '-');

function initials(user) {
  if (!user) return '?';
  return user.initials ?? user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function person(user) {
  return user
    ? `<span class="bl-person"><span class="tc-avatar bl-avatar">${esc(initials(user))}</span><span class="bl-person-name">${esc(user.name)}</span></span>`
    : `<span class="bl-person bl-person-none"><span class="tc-avatar bl-avatar tc-avatar-none">?</span><span class="bl-person-name">Sem responsável</span></span>`;
}

export async function initBacklog(container) {
  const currentUser = await getCurrentUser();

  let tasks = [], users = [], sectors = [], types = [], cats = [];
  let manager = false, restricted = [];
  let sectorOf = new Map();   // taskId → sectorId

  // Seleção e filtros (mantidos entre recarregamentos)
  let selSector    = null;
  let selType      = null;
  let search       = '';
  let statusFilter = '';
  let onlyNoResp   = false;
  const expanded   = new Set();

  async function reload() {
    let all;
    [all, users, sectors, types, cats, manager, restricted] = await Promise.all([
      getTasks(), getUsers(), getSectors(), getActivityTypes(), getCategories(),
      isManager(currentUser), getRestrictedSectorIds(),
    ]);

    sectorOf = new Map(all.map(t => [t.id, taskSectorId(t, users) ?? NO_SECTOR]));

    // Visibilidade: Admin/Gestão ficam ocultos para quem não é desses setores,
    // exceto as tarefas criadas pelo próprio usuário.
    const visible = t =>
      manager || t.createdById === currentUser.id || !restricted.includes(sectorOf.get(t.id));

    const top = all.filter(t => t.type === 'task' && visible(t));
    const topIds = new Set(top.map(t => t.id));
    tasks = [...top, ...all.filter(t => t.type === 'subtask' && topIds.has(t.parentId))];
  }

  const topTasks   = () => tasks.filter(t => t.type === 'task');
  const subsOf     = id => tasks.filter(t => t.parentId === id);
  const inSelected = t => sectorOf.get(t.id) === selSector;

  // ── Setores ──

  function sectorList() {
    const counts = {};
    topTasks().forEach(t => { const s = sectorOf.get(t.id); counts[s] = (counts[s] ?? 0) + 1; });

    const list = sectors
      .filter(s => s.id !== 'ALL')
      .filter(s => manager || !restricted.includes(s.id) || counts[s.id])
      .map(s => ({ id: s.id, name: s.name, count: counts[s.id] ?? 0 }));

    if (counts[NO_SECTOR]) list.push({ id: NO_SECTOR, name: 'Sem setor', count: counts[NO_SECTOR] });
    return list;
  }

  // ── Tipos de atividade do setor ──

  function typeList() {
    const inSector = topTasks().filter(inSelected);
    const counts = {};
    inSector.forEach(t => { counts[t.activityTypeId] = (counts[t.activityTypeId] ?? 0) + 1; });

    // Tipos disponíveis ao setor + tipos que já têm tarefas nele
    const list = types
      .filter(a => counts[a.id] || (selSector !== NO_SECTOR && (a.sectorIds.includes('ALL') || a.sectorIds.includes(selSector))))
      .map(a => ({ id: a.id, name: a.name, count: counts[a.id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

    return [{ id: ALL_TYPES, name: 'Todos os tipos', count: inSector.length }, ...list];
  }

  // ── Tarefas filtradas ──

  function filteredTasks() {
    const term = search.trim().toLowerCase();
    return topTasks()
      .filter(inSelected)
      .filter(t => selType === ALL_TYPES || t.activityTypeId === selType)
      .filter(t => !statusFilter || t.status === statusFilter)
      .filter(t => !onlyNoResp || !responsibleOf(t))
      .filter(t => !term || t.name.toLowerCase().includes(term))
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  }

  // ── Render ──

  function renderSectors() {
    const list = sectorList();
    document.getElementById('bl-sectors').innerHTML = list.length
      ? list.map(s => `
          <button type="button" class="bl-card${s.id === selSector ? ' active' : ''}" data-sector="${s.id}">
            <span class="bl-card-name">${esc(s.name)}</span>
            <span class="badge badge-count">${s.count}</span>
          </button>`).join('')
      : '<div class="bl-empty">Nenhum setor disponível.</div>';
  }

  function renderTypes() {
    const wrap = document.getElementById('bl-types-section');
    wrap.classList.toggle('hidden', !selSector);
    if (!selSector) return;

    const sector = sectorList().find(s => s.id === selSector);
    document.getElementById('bl-types-title').textContent = `Tipos de atividade — ${sector?.name ?? ''}`;

    const list = typeList();
    document.getElementById('bl-types').innerHTML = list.length > 1 || list[0].count
      ? list.map(t => `
          <button type="button" class="bl-card bl-card-type${t.id === selType ? ' active' : ''}${!t.count ? ' is-empty' : ''}" data-type="${t.id}">
            <span class="bl-card-name">${esc(t.name)}</span>
            <span class="bl-card-count">${t.count} ${t.count === 1 ? 'tarefa' : 'tarefas'}</span>
          </button>`).join('')
      : '<div class="bl-empty">Nenhum tipo de atividade disponível para este setor.</div>';
  }

  function taskRow(t, isSub = false) {
    const subs = isSub ? [] : subsOf(t.id);
    const open = expanded.has(t.id);
    const cat  = cats.find(c => c.id === t.categoryId);
    const resp = users.find(u => u.id === responsibleOf(t));
    const by   = users.find(u => u.id === t.createdById);
    const ov   = isOverdue(t.deadline, t.status);

    return `
      <tr class="bl-row${isSub ? ' bl-row-sub' : ''}${t.status === 'Concluído' ? ' is-done' : ''}" data-id="${t.id}" tabindex="0">
        <td class="bl-col-task">
          <div class="bl-task-cell">
            ${isSub ? '<span class="bl-sub-mark">↳</span>'
              : subs.length
                ? `<button type="button" class="bl-expand${open ? ' open' : ''}" data-expand="${t.id}" title="${open ? 'Ocultar' : 'Mostrar'} sub-tarefas">
                     <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                   </button>`
                : '<span class="bl-expand-spacer"></span>'}
            <span class="bl-task-name">${esc(t.name)}</span>
            ${subs.length ? `<span class="bl-sub-count" title="Sub-tarefas">${subs.length}</span>` : ''}
          </div>
        </td>
        <td>${person(resp)}</td>
        <td>${cat ? `<span class="badge badge-cat">${esc(cat.name)}</span>` : '<span class="text-muted text-small">—</span>'}</td>
        <td>${by ? person(by) : '<span class="text-muted text-small">—</span>'}</td>
        <td>${t.priority ? `<span class="badge badge-priority-${slug(t.priority)}">${esc(t.priority)}</span>` : ''}</td>
        <td><span class="badge badge-status-${slug(t.status)}">${esc(t.status)}</span></td>
        <td class="bl-col-date${ov ? ' overdue' : ''}">${ov ? '⏰ ' : ''}${formatDate(t.deadline)}</td>
      </tr>
      ${open ? subs.map(s => taskRow(s, true)).join('') : ''}`;
  }

  function renderTable() {
    const section = document.getElementById('bl-table-section');
    section.classList.toggle('hidden', !selType);
    if (!selType) return;

    const rows = filteredTasks();
    document.getElementById('bl-count').textContent = rows.length;

    document.getElementById('bl-table-body').innerHTML = rows.length
      ? rows.map(t => taskRow(t)).join('')
      : `<tr><td colspan="7"><div class="bl-empty">Nenhuma tarefa encontrada.</div></td></tr>`;
  }

  function renderAll() {
    renderSectors();
    renderTypes();
    renderTable();
  }

  async function openTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    openTaskDetail(t, async () => { await reload(); renderAll(); });
  }

  // ── Layout ──

  container.innerHTML = `
    <div class="bl-section">
      <div class="bl-section-title">Setores</div>
      <div class="bl-cards" id="bl-sectors"></div>
    </div>

    <div class="bl-section hidden" id="bl-types-section">
      <div class="bl-section-title" id="bl-types-title">Tipos de atividade</div>
      <div class="bl-cards" id="bl-types"></div>
    </div>

    <div class="bl-section hidden" id="bl-table-section">
      <div class="bl-toolbar">
        <div class="search-wrap bl-search">
          <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" class="search-input" id="bl-search" placeholder="Pesquisar tarefa..." />
        </div>
        <select class="filter-select" id="bl-status" title="Filtrar por status">
          <option value="">Todos os status</option>
          ${STATUS_OPTS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button type="button" class="sort-button" id="bl-no-resp" title="Mostrar apenas tarefas sem responsável">Sem responsável</button>
        <span class="bl-toolbar-count">Tarefas: <strong id="bl-count">0</strong></span>
        <button class="btn btn-primary btn-sm" id="bl-new">${icon('plus', 15)} Nova Tarefa</button>
      </div>

      <div class="bl-table-wrap">
        <table class="adm-table bl-table">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Responsável</th>
              <th>Categoria</th>
              <th>Criado por</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody id="bl-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  // ── Eventos ──

  document.getElementById('bl-sectors').addEventListener('click', e => {
    const card = e.target.closest('[data-sector]');
    if (!card) return;
    selSector = card.dataset.sector;
    selType   = null;
    expanded.clear();
    renderAll();
  });

  document.getElementById('bl-types').addEventListener('click', e => {
    const card = e.target.closest('[data-type]');
    if (!card) return;
    selType = card.dataset.type;
    expanded.clear();
    renderTypes();
    renderTable();
  });

  const body = document.getElementById('bl-table-body');
  body.addEventListener('click', e => {
    const exp = e.target.closest('[data-expand]');
    if (exp) {
      const id = exp.dataset.expand;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      renderTable();
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (row) openTask(row.dataset.id);
  });
  body.addEventListener('keydown', e => {
    const row = e.target.closest('tr[data-id]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTask(row.dataset.id); }
  });

  document.getElementById('bl-search').addEventListener('input', e => { search = e.target.value; renderTable(); });
  document.getElementById('bl-status').addEventListener('change', e => { statusFilter = e.target.value; renderTable(); });
  document.getElementById('bl-no-resp').addEventListener('click', e => {
    onlyNoResp = !onlyNoResp;
    e.currentTarget.classList.toggle('active', onlyNoResp);
    renderTable();
  });

  document.getElementById('bl-new').addEventListener('click', () => {
    openCreateTask(async () => { await reload(); renderAll(); }, null, null, {
      backlog: true,
      sectorId: selSector !== NO_SECTOR ? selSector : '',
      activityTypeId: selType !== ALL_TYPES ? selType : '',
    });
  });

  // ── Boot: abre no primeiro setor do usuário ──
  await reload();
  const list = sectorList();
  selSector = (list.find(s => currentUser.sectorIds?.includes(s.id)) ?? list[0])?.id ?? null;
  renderAll();
}
