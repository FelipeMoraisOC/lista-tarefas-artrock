// ── Modals: Create Task & Task Detail ────────────────────

import {
  getTasks, getUsers, getCategories, getActivityTypes, getSectors,
  getActivityTypesForUser, getCurrentUser, createTask, updateTask, deleteTask,
  isManager, canEditTask,
} from '../store.js';
import { renderMd } from '../components/markdown.js';
import { initEditor, destroyAllEditors } from '../components/editor.js';
import { createSearchableSelect } from '../components/searchable-select.js';
import { showToast, formatDatetime, formatDuration, todayISO, generateId, responsibleOf } from '../utils.js';
import { timerHoursFor, syncTimerHours, commitTimerIfActive, onTimerTick } from '../components/task-timer.js';

// ── Modal shell helpers ───────────────────────────────────

export function openShell(content, cls = '') {
  const overlay   = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  container.innerHTML = `<div class="modal tc tc-scrollable ${cls}" id="_modal">${content}</div>`;
  overlay.classList.remove('hidden');

  document.getElementById('modal-scroll-wrap').scrollTop = 0;
  document.getElementById('modal-backdrop').onclick = closeModal;

  const esc = e => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

export function closeModal() {
  destroyAllEditors();
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').innerHTML = '';
}

// ── Shared helpers ────────────────────────────────────────

const statusOpts = ['Para Fazer', 'Em Andamento', 'Concluído'];
const priorOpts  = ['Alta', 'Média', 'Baixa'];

const slug = s => s.toLowerCase().replace(/ /g, '-');
const DESCRIPTION_DRAFT_PREFIX = 'artrock:task-description-draft:';

function descriptionDraftKey(taskId) {
  return `${DESCRIPTION_DRAFT_PREFIX}${taskId}`;
}

function getDescriptionDraft(taskId) {
  return localStorage.getItem(descriptionDraftKey(taskId));
}

function saveDescriptionDraft(taskId, value) {
  localStorage.setItem(descriptionDraftKey(taskId), value);
}

function clearDescriptionDraft(taskId) {
  localStorage.removeItem(descriptionDraftKey(taskId));
}

function updateCompletionSlider(slider, label) {
  slider.classList.toggle('is-complete', Number(slider.value) === 100);
  label.textContent = slider.value + '%';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function initials(user) {
  if (!user) return '?';
  return user.initials ?? user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function catOptions(cats, selId = '') {
  if (!cats.length) return `<option value="">Nenhuma categoria disponível</option>`;
  return cats.map(c => `<option value="${c.id}" ${c.id === selId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}

const ICONS = {
  plus:    'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  check:   'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  list:    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z',
  desc:    'M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z',
  sub:     'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  info:    'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  comment: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
  save:    'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
  edit:    'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  calendar:'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.89-2-2-2zm0 16H5V9h14v11zM5 7V6h14v1H5z',
  trash:   'M6 19c0 1.1.9 2 2 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  tag:     'M21.41 11.58l-9-9A2 2 0 0011 2H4a2 2 0 00-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7A1.5 1.5 0 014 5.5 1.5 1.5 0 015.5 4 1.5 1.5 0 017 5.5 1.5 1.5 0 015.5 7z',
  warn:    'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
};
export const icon = (name, size = 16) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}"><path d="${ICONS[name]}"/></svg>`;

function sectionHead(iconName, title, actionHtml = '') {
  return `
    <div class="tc-section-head">
      <span class="tc-section-icon">${icon(iconName, 20)}</span>
      <span class="tc-section-title">${title}</span>
      ${actionHtml}
    </div>`;
}

function setErr(inputId, hasError) {
  const el = document.getElementById(inputId);
  if (!el) return;
  (el.closest('.tc-field') ?? el.parentElement)?.classList.toggle('has-error', hasError);
}

function openResponsiblePicker(users, currentId, { allowNone = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'tc-resp-modal';
    let selectedId = currentId || '';

    function render(filter = '') {
      const term = filter.toLowerCase().trim();
      const filtered = term
        ? users.filter(u => u.name.toLowerCase().includes(term))
        : users;

      // Opção "Sem responsável" — usada no Backlog para atribuir depois
      const noneHtml = allowNone && !term ? `
            <div class="tc-resp-user${!selectedId ? ' selected' : ''}" data-id="">
              <span class="tc-avatar tc-avatar-none">?</span>
              <div class="tc-resp-user-info">
                <div class="tc-resp-user-name">Sem responsável</div>
                <div class="tc-resp-user-role">Atribuir depois</div>
              </div>
              ${!selectedId ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#6ea8ff;flex-shrink:0"><path d="${ICONS.check}"/></svg>` : ''}
            </div>` : '';

      const listHtml = noneHtml + (filtered.length
        ? filtered.map(u => `
            <div class="tc-resp-user${u.id === selectedId ? ' selected' : ''}" data-id="${u.id}">
              <span class="tc-avatar">${esc(initials(u))}</span>
              <div class="tc-resp-user-info">
                <div class="tc-resp-user-name">${esc(u.name)}</div>
                <div class="tc-resp-user-role">${esc(u.role ?? '')}</div>
              </div>
              ${u.id === selectedId ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#6ea8ff;flex-shrink:0"><path d="${ICONS.check}"/></svg>` : ''}
            </div>`).join('')
        : `<div class="tc-resp-empty">Nenhum usuário encontrado</div>`);

      overlay.innerHTML = `
        <div class="tc-resp-backdrop"></div>
        <div class="tc tc-resp-card">
          <div class="tc-resp-header">
            <span class="tc-resp-title">Escolher Responsável</span>
            <button class="tc-icon-btn" id="resp-close" title="Fechar">✕</button>
          </div>
          <div class="tc-resp-search-wrap">
            <input type="text" class="tc-resp-search" id="resp-search" placeholder="Filtrar por nome..." value="${esc(filter)}" autocomplete="off" />
          </div>
          <div class="tc-resp-list">${listHtml}</div>
          <div class="tc-resp-footer">
            <button class="tc-btn" id="resp-cancel">Cancelar</button>
            <button class="tc-btn tc-btn-primary" id="resp-confirm">Confirmar</button>
          </div>
        </div>`;

      overlay.querySelector('#resp-close').onclick = close;
      overlay.querySelector('.tc-resp-backdrop').onclick = close;
      overlay.querySelector('#resp-cancel').onclick = close;
      overlay.querySelector('#resp-confirm').onclick = () => {
        done(selectedId);
      };

      const searchInput = overlay.querySelector('#resp-search');
      searchInput.addEventListener('input', e => render(e.target.value));
      searchInput.focus();

      overlay.querySelectorAll('.tc-resp-user').forEach(el => {
        el.addEventListener('click', () => {
          selectedId = el.dataset.id;
          render(searchInput.value);
        });
      });
    }

    function close() { done(null); }
    function done(val) {
      overlay.remove();
      resolve(val);
    }

    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });

    render();
    document.body.appendChild(overlay);
  });
}

// ═══════════════════════════════════════════════════════════
// CREATE TASK MODAL
// ═══════════════════════════════════════════════════════════

// Modo Backlog (`opts.backlog`): escolhe primeiro o setor, que filtra tipo e
// categoria; a tarefa pode ser criada sem responsável.
// `opts.sectorId` / `opts.activityTypeId` pré-selecionam os campos.
export async function openCreateTask(onSave, parentId = null, parentData = null, opts = {}) {
  const [currentUser, users, categories, activityTypes, sectors] = await Promise.all([
    getCurrentUser(), getUsers(), getCategories(), getActivityTypes(), getSectors(),
  ]);

  const backlog = !!opts.backlog;
  const isSub   = !!parentId;
  const myAT    = backlog ? [] : await getActivityTypesForUser(currentUser);

  let sectorId   = parentData?.sectorId ?? opts.sectorId ?? '';
  const preAtId  = parentData?.activityTypeId ?? opts.activityTypeId ?? '';
  const preCatId = parentData?.categoryId ?? '';

  const inSector = (ids, sid) => ids.includes('ALL') || ids.includes(sid);

  function typesFor(sid) {
    if (!backlog) return myAT;
    return sid ? activityTypes.filter(a => inSector(a.sectorIds, sid)) : [];
  }

  function catsFor(atId) {
    if (!atId) return [];
    return categories.filter(c =>
      c.activityTypeId === atId && (backlog
        ? inSector(c.sectorIds, sectorId)
        : c.sectorIds.includes('ALL') || c.sectorIds.some(s => currentUser.sectorIds.includes(s)))
    );
  }

  // Responsáveis possíveis: no Backlog, apenas usuários do setor escolhido
  const usersFor = sid => backlog && sid ? users.filter(u => inSector(u.sectorIds ?? [], sid)) : users;

  const typeOptions = (sid, selId) => backlog && !sid
    ? '<option value="">Selecione o setor primeiro...</option>'
    : `<option value="">Tipo de atividade...</option>
       ${typesFor(sid).map(a => `<option value="${a.id}" ${a.id === selId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}`;

  const presetAt = typesFor(sectorId).some(a => a.id === preAtId) || isSub ? preAtId : '';

  openShell(`
    <div class="tc-topbar">
      <div class="tc-topbar-left">
        ${backlog ? `
        <span class="tc-field">
          <select class="tc-pill-select" id="fc-sector" ${isSub ? 'disabled' : ''} title="Setor">
            <option value="">Setor...</option>
            ${sectors.filter(s => s.id !== 'ALL').map(s => `<option value="${s.id}" ${s.id === sectorId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </span>` : ''}
        <span class="tc-field">
          <select class="tc-pill-select" id="fc-at" ${isSub ? 'disabled' : ''} title="Tipo de Atividade">
            ${isSub
              ? `<option value="${preAtId}">${esc(activityTypes.find(a => a.id === preAtId)?.name ?? 'Tipo de atividade')}</option>`
              : typeOptions(sectorId, presetAt)}
          </select>
        </span>
        <span class="tc-field">
          <select class="tc-pill-select" id="fc-cat" ${isSub ? 'disabled' : ''} title="Categoria">
            ${isSub
              ? `<option value="${preCatId}">${esc(categories.find(c => c.id === preCatId)?.name ?? 'Categoria')}</option>`
              : `<option value="">${presetAt ? 'Categoria...' : 'Selecione o tipo primeiro...'}</option>
                 ${catsFor(presetAt).map(c => `<option value="${c.id}" ${c.id === preCatId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`}
          </select>
        </span>
      </div>
      <div class="tc-topbar-right">
        <button class="tc-icon-btn" id="mc-close" title="Fechar">✕</button>
      </div>
    </div>

    <div class="tc-body tc-body-single">
      <div class="tc-main">
        ${isSub ? `
          <div class="tc-note">Sub-tarefa: Tipo de Atividade e Categoria herdados da tarefa pai.</div>` : ''}

        <div class="tc-title-row">
          <button class="tc-check" id="fc-check" title="Marcar como concluída">${icon('check', 14)}</button>
          <div class="tc-field tc-title-field">
            <input type="text" class="tc-title-input" id="fc-name"
              placeholder="${isSub ? 'Nome da sub-tarefa' : 'Nome da tarefa'}" autocomplete="off" />
          </div>
        </div>

        <div class="tc-meta-row">
          <div class="tc-meta">
            <div class="tc-meta-label">Status</div>
            <select class="tc-chip-select" id="fc-status">
              ${statusOpts.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="tc-meta">
            <div class="tc-meta-label">Etiquetas</div>
            <select class="tc-chip-select tc-prio-média" id="fc-priority">
              ${priorOpts.map(p => `<option value="${p}" ${p === 'Média' ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="tc-meta tc-field">
            <div class="tc-meta-label req">Data Entrega</div>
            <input type="date" class="tc-date" id="fc-deadline" />
          </div>
          <div class="tc-meta">
            <div class="tc-meta-label">Solicitante</div>
            <select class="tc-chip-select" id="fc-requester">
              <option value="">Nenhum</option>
              ${users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="tc-section">
          ${sectionHead('desc', 'Descrição', '<span class="tc-hint">suporta Markdown</span>')}
          <div class="tc-section-body">
            <textarea class="tc-textarea" id="fc-desc" rows="5"
              placeholder="Adicione uma descrição mais detalhada..."></textarea>
          </div>
        </div>

        <div class="tc-section">
          ${sectionHead('info', 'Detalhes')}
          <div class="tc-section-body tc-details-grid" id="fc-details">
            <div class="tc-field">
              <div class="tc-meta-label">Data de Início</div>
              <input type="date" class="tc-input" id="fc-start" />
            </div>
            <div class="tc-field">
              <div class="tc-meta-label">Data de Conclusão</div>
              <input type="date" class="tc-input" id="fc-end" />
            </div>
            <div class="tc-field">
              <div class="tc-meta-label tc-req-done">Horas Investidas</div>
              <input type="number" class="tc-input" id="fc-hours" min="0.5" step="0.5" placeholder="Ex: 4.5" />
            </div>
            <div class="tc-field">
              <div class="tc-meta-label">% de Conclusão</div>
              <div class="tc-range">
                <input type="range" class="completion-slider" id="fc-pct" min="0" max="100" value="0" step="5" />
                <span id="fc-pct-lbl">0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tc-footer">
      <div class="tc-footer-left">
        <button class="tc-btn tc-btn-blue" id="mc-pick-resp">${icon('plus', 15)} ${backlog ? 'Sem responsável' : 'Responsável'}</button>
      </div>
      <button class="tc-btn" id="mc-cancel">Cancelar</button>
      <button class="tc-btn tc-btn-primary" id="mc-save">${icon('save', 15)} ${isSub ? 'Criar Sub-tarefa' : 'Criar Tarefa'}</button>
    </div>
  `, 'tc-create');

  const $ = id => document.getElementById(id);
  const root = $('_modal');

  // ── Events ──
  $('mc-close').onclick  = closeModal;
  $('mc-cancel').onclick = closeModal;
  $('fc-name').focus();

  let chosenResponsibleId = null;
  const respBtn = $('mc-pick-resp');
  function setResponsible(id) {
    chosenResponsibleId = id || null;
    const u = users.find(x => x.id === chosenResponsibleId);
    respBtn.innerHTML = `${icon('plus', 15)} ${u ? esc(u.name) : backlog ? 'Sem responsável' : 'Responsável'}`;
  }
  respBtn.addEventListener('click', async () => {
    const picked = await openResponsiblePicker(usersFor(sectorId), chosenResponsibleId, { allowNone: backlog });
    if (picked !== null) setResponsible(picked);
  });

  // Initialize EasyMDE rich editor for description
  const fcDescEditor = initEditor($('fc-desc'), {
    placeholder: 'Adicione uma descrição mais detalhada...',
    minHeight: 120,
  });

  // Setor → tipos de atividade (apenas Backlog)
  if (backlog && !isSub) {
    $('fc-sector').addEventListener('change', e => {
      sectorId = e.target.value;
      $('fc-at').innerHTML  = typeOptions(sectorId, '');
      $('fc-cat').innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
      // Responsável escolhido precisa pertencer ao novo setor
      if (chosenResponsibleId && !usersFor(sectorId).some(u => u.id === chosenResponsibleId)) setResponsible(null);
    });
  }

  // Activity type → populate categories
  if (!isSub) {
    $('fc-at').addEventListener('change', e => {
      const cats = catsFor(e.target.value);
      $('fc-cat').innerHTML = `<option value="">Categoria...</option>${catOptions(cats)}`;
    });
  }

  // Priority chip color
  const prioSel = $('fc-priority');
  prioSel.addEventListener('change', () => { prioSel.className = `tc-chip-select tc-prio-${slug(prioSel.value)}`; });

  // Status ↔ check circle
  function applyStatus(status) {
    $('fc-status').value = status;
    const done = status === 'Concluído';
    root.classList.toggle('tc-is-done', done);
    if (done) {
      const today = todayISO();
      if (!$('fc-end').value)   $('fc-end').value   = today;
      if (!$('fc-start').value) $('fc-start').value = today;
      $('fc-pct').value = 100; $('fc-pct-lbl').textContent = '100%';
    }
  }
  $('fc-status').addEventListener('change', e => applyStatus(e.target.value));
  $('fc-check').addEventListener('click', () =>
    applyStatus($('fc-status').value === 'Concluído' ? 'Para Fazer' : 'Concluído'));

  // Slider label
  updateCompletionSlider($('fc-pct'), $('fc-pct-lbl'));
  $('fc-pct').addEventListener('input', e =>
    updateCompletionSlider(e.target, $('fc-pct-lbl')));

  // Save
  $('mc-save').addEventListener('click', async () => {
    let ok = true;

    const name = $('fc-name').value.trim();
    setErr('fc-name', !name); if (!name) ok = false;

    const atId  = isSub ? preAtId  : $('fc-at').value;
    const catId = isSub ? preCatId : $('fc-cat').value;
    if (backlog && !isSub) {
      setErr('fc-sector', !sectorId); if (!sectorId) ok = false;
    }
    if (!isSub) {
      setErr('fc-at',  !atId);  if (!atId)  ok = false;
      setErr('fc-cat', !catId); if (!catId) ok = false;
    }

    const deadline = $('fc-deadline').value;
    setErr('fc-deadline', !deadline); if (!deadline) ok = false;

    const status = $('fc-status').value;
    const h = parseFloat($('fc-hours').value);
    const hoursInvested = h > 0 ? h : null;
    if (status === 'Concluído' && !isSub) {
      setErr('fc-hours', !hoursInvested); if (!hoursInvested) ok = false;
    }

    if (!ok) { showToast('Preencha os campos obrigatórios.', 'error'); return; }

    // Subtask hours guard
    if (isSub && hoursInvested && parentId) {
      const all = await getTasks();
      const parent = all.find(t => t.id === parentId);
      if (parent?.hoursInvested && hoursInvested > parent.hoursInvested) {
        showToast('Horas da sub-tarefa não podem exceder as horas da tarefa pai.', 'error');
        return;
      }
    }

    const btn = $('mc-save');
    btn.disabled = true; btn.textContent = 'Salvando...';

    try {
      await createTask({
        type: isSub ? 'subtask' : 'task',
        parentId: parentId ?? null,
        status,
        name,
        description: fcDescEditor ? fcDescEditor.value() : $('fc-desc').value,
        activityTypeId: atId,
        categoryId:     catId,
        requesterId:    $('fc-requester').value || null,
        deadline,
        priority:           $('fc-priority').value,
        startDate:          $('fc-start').value || null,
        endDate:            $('fc-end').value   || null,
        completionPercent:  parseInt($('fc-pct').value) || 0,
        hoursInvested,
        checklist: [],
        comments:  [],
        createdById: currentUser.id,
        responsibleId: backlog ? chosenResponsibleId : (chosenResponsibleId || currentUser.id),
        ...(sectorId ? { sectorId } : {}),
      });
      closeModal();
      showToast(isSub ? 'Sub-tarefa criada!' : 'Tarefa criada!', 'success');
      if (onSave) await onSave();
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
      btn.disabled = false; btn.innerHTML = `${icon('save', 15)} ${isSub ? 'Criar Sub-tarefa' : 'Criar Tarefa'}`;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// TASK DETAIL MODAL
// ═══════════════════════════════════════════════════════════

export async function openTaskDetail(task, onSave) {
  const [allTasks, users, categories, activityTypes, sectors, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getActivityTypes(), getSectors(), getCurrentUser(),
  ]);

  const subtasks = allTasks.filter(t => t.parentId === task.id);
  const isSub    = task.type === 'subtask';
  const parent   = isSub ? allTasks.find(t => t.id === task.parentId) : null;

  // Somente responsável, criador ou Admin/Gestão editam; os demais só visualizam.
  const readOnly = !canEditTask(task, currentUser, await isManager(currentUser), parent);

  // Working copy
  const localDescription = getDescriptionDraft(task.id);
  let W = {
    ...task,
    description: localDescription ?? task.description,
    checklist: [...(task.checklist ?? [])],
    comments: [...(task.comments ?? [])],
  };
  let showActivity = true;

  // Timer do menu: horas ao vivo (tarefa ativa) ou gravadas por ele há pouco
  const openedAt = Date.now();
  const timerAtOpen = timerHoursFor(task.id);
  if (timerAtOpen) W.hoursInvested = timerAtOpen.hours;
  let hoursEdited = false;   // o usuário mexeu em Horas Investidas → vale o valor digitado
  const round2 = h => (h == null ? '' : Math.round(h * 100) / 100);

  function markDirty() {
    if (readOnly) return;
    const btn = document.getElementById('dd-save');
    if (btn) btn.style.display = 'inline-flex';
  }

  // Tarefas do Backlog usam os setores da própria tarefa; as demais, os do usuário.
  const scopeSectors = task.sectorId ? [task.sectorId] : currentUser.sectorIds;
  const inScope = ids => ids.includes('ALL') || ids.some(s => scopeSectors.includes(s));

  function myAT() {
    return activityTypes.filter(a => inScope(a.sectorIds) || a.id === task.activityTypeId);
  }

  function catsFor(atId) {
    return categories.filter(c =>
      c.activityTypeId === atId && (inScope(c.sectorIds) || c.id === task.categoryId)
    );
  }

  function renderSubItem(st) {
    const sc = categories.find(c => c.id === st.categoryId);
    return `
      <div class="subtask-item tc-sub-item" data-id="${st.id}" role="button" tabindex="0">
        <span class="tc-sub-dot ${st.status === 'Concluído' ? 'done' : ''}">${st.status === 'Concluído' ? icon('check', 11) : ''}</span>
        <span class="subtask-name">${esc(st.name)}</span>
        ${sc ? `<span class="tc-tag">${esc(sc.name)}</span>` : ''}
        <span class="tc-tag tc-status-${slug(st.status)}">${st.status}</span>
        <span class="tc-tag tc-prio-${slug(st.priority)}">${st.priority}</span>
      </div>`;
  }

  const descPlaceholder = `<p class="desc-placeholder">Adicione uma descrição mais detalhada...</p>`;

  openShell(`
    <div class="tc-topbar">
      <div class="tc-topbar-left">
        <select class="tc-pill-select" id="dd-at" ${isSub ? 'disabled' : ''} title="Tipo de Atividade">
          ${myAT().map(a => `<option value="${a.id}" ${W.activityTypeId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
        <select class="tc-pill-select" id="dd-cat" ${isSub ? 'disabled' : ''} title="Categoria">
          ${catOptions(catsFor(W.activityTypeId), W.categoryId)}
        </select>
      </div>
      <div class="tc-topbar-right">
        <button class="tc-btn tc-btn-primary tc-btn-sm" id="dd-save" style="display:none">${icon('save', 13)} Salvar</button>
        <button class="tc-icon-btn" id="dd-close" title="Fechar">✕</button>
      </div>
    </div>

    <div class="tc-body">
      <!-- ── Main ── -->
      <div class="tc-main">
        ${readOnly ? `
          <div class="tc-note tc-readonly-note">${icon('info', 15)} Modo visualização — apenas o responsável, quem criou a tarefa ou os setores Admin e Gestão podem editar ou excluir.</div>` : ''}
        ${isSub ? `
          <div class="tc-note">↳ Sub-tarefa de: <strong>${esc(allTasks.find(t => t.id === W.parentId)?.name ?? W.parentId)}</strong></div>` : ''}

        <div class="tc-title-row">
          <button class="tc-check" id="dd-check" title="Marcar como concluída">${icon('check', 14)}</button>
          <div class="tc-title-field">
            <div id="dd-name-view" class="tc-title-view" title="Clique para editar">${esc(W.name)}</div>
            <input id="dd-name-input" class="tc-title-input" type="text" value="${esc(W.name)}" style="display:none" />
          </div>
        </div>

        <div class="tc-meta-row">
          <div class="tc-meta">
            <div class="tc-meta-label">Status</div>
            <select class="tc-chip-select tc-status-${slug(W.status)}" id="dd-status">
              ${statusOpts.map(s => `<option value="${s}" ${W.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="tc-meta">
            <div class="tc-meta-label">Prioridade</div>
            <select class="tc-chip-select tc-prio-${slug(W.priority)}" id="dd-priority">
              ${priorOpts.map(p => `<option value="${p}" ${W.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="tc-meta">
            <div class="tc-meta-label">Data Entrega</div>
            <input type="date" class="tc-date" id="dd-deadline" value="${W.deadline ?? ''}" />
          </div>
          <div class="tc-meta">
            <div class="tc-meta-label">Solicitante</div>
            <select class="tc-chip-select" id="dd-req">
              <option value="">Nenhum</option>
              ${users.map(u => `<option value="${u.id}" ${W.requesterId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="tc-actions tc-edit-only">
          ${!isSub ? `<button class="tc-btn" id="dd-add-sub">${icon('plus', 15)} Sub-tarefa</button>` : ''}
          <button class="tc-btn" id="dd-add-check">${icon('list', 15)} Checklist</button>
        </div>

        <!-- Description -->
        <div class="tc-section">
          ${sectionHead('desc', 'Descrição', `<button class="tc-btn tc-btn-sm tc-edit-only" id="dd-desc-toggle">Editar</button>`)}
          <div class="tc-section-body">
            <div id="dd-desc-view" class="markdown-body tc-md">${W.description ? renderMd(W.description) : descPlaceholder}</div>
            <div id="dd-desc-edit" style="display:none">
              <textarea class="tc-textarea" id="dd-desc-ta" rows="8">${esc(W.description ?? '')}</textarea>
              <div class="tc-inline-actions">
                <span class="tc-hint">Rascunho salvo automaticamente neste computador.</span>
                <button class="tc-btn tc-btn-sm tc-btn-flat" id="dd-desc-close">Fechar edição</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Checklist -->
        <div class="tc-section" id="dd-check-sec" style="display:none">
          ${sectionHead('list', 'Checklist', `<span class="tc-hint" id="dd-check-count"></span>`)}
          <div class="tc-section-body">
            <div class="tc-progress"><span class="tc-progress-pct" id="dd-check-pct">0%</span><div class="tc-progress-bar"><div id="dd-check-bar"></div></div></div>
            <div id="dd-check-list" class="tc-check-list"></div>
            <div class="tc-check-add tc-edit-only">
              <input type="text" class="tc-input" id="dd-check-input" placeholder="Adicionar um item..." />
              <button class="tc-btn tc-btn-sm" id="dd-check-add-btn">Adicionar</button>
            </div>
          </div>
        </div>

        <!-- Sub-tasks -->
        ${!isSub ? `
          <div class="tc-section">
            ${sectionHead('sub', `Sub-tarefas <span class="tc-count">${subtasks.length}</span>`)}
            <div class="tc-section-body">
              <div class="subtask-list" id="dd-sub-list">
                ${subtasks.length ? subtasks.map(renderSubItem).join('') :
                  '<div class="tc-empty">Nenhuma sub-tarefa.</div>'}
              </div>
            </div>
          </div>` : ''}

        <!-- Details -->
        <div class="tc-section">
          ${sectionHead('calendar', 'Para Entrega')}
          <div class="tc-section-body tc-details-grid">
            <div class="tc-field">
              <div class="tc-meta-label ${!isSub ? 'tc-req-done' : ''}">Data de Início</div>
              <input type="date" class="tc-input" id="dd-start" value="${W.startDate ?? ''}" />
            </div>
            <div class="tc-field">
              <div class="tc-meta-label ${!isSub ? 'tc-req-done' : ''}">Data de Conclusão</div>
              <input type="date" class="tc-input" id="dd-end" value="${W.endDate ?? ''}" />
            </div>
            <div class="tc-field">
              <div class="tc-meta-label ${!isSub ? 'tc-req-done' : ''}">Horas Investidas</div>
              <input type="number" class="tc-input" id="dd-hours" value="${round2(W.hoursInvested)}" min="0" step="any" placeholder="—" />
              <div class="tc-hint tc-timer-hint" id="dd-hours-live"></div>
            </div>
            <div class="tc-field">
              <div class="tc-meta-label">% de Conclusão</div>
              <div class="tc-range">
                <input type="range" class="completion-slider" id="dd-pct" min="0" max="100" value="${W.completionPercent ?? 0}" step="5" />
                <span id="dd-pct-lbl">${W.completionPercent ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Actions -->
        <div class="tc-section tc-edit-only">
              ${sectionHead('warn', 'Ações')}
              <div class="tc-section-body">
                <div id="dd-delete-action">
                  <button class="tc-btn tc-btn-danger" id="dd-delete">${icon('trash', 15)} Excluir</button>
                </div>
                <div id="dd-delete-confirm" class="tc-delete-confirm" style="display:none">
                  <p class="tc-confirm-text">Para excluir <strong>${esc(W.name)}</strong> permanentemente, digite <strong>excluir</strong>.</p>
                  <label class="tc-confirm-label" for="dd-delete-input">Digite "excluir" para confirmar</label>
                  <input class="tc-input tc-confirm-input" id="dd-delete-input" type="text" autocomplete="off" />
                  <div class="tc-inline-actions">
                    <button class="tc-btn tc-btn-sm tc-btn-flat" id="dd-delete-cancel">Cancelar</button>
                    <button class="tc-btn tc-btn-danger tc-btn-sm" id="dd-delete-confirm-btn" disabled>Confirmar exclusão</button>
                  </div>
                </div>
              </div>
            </div>
      </div>

      <!-- ── Comments & activity ── -->
      <aside class="tc-side">
        <div class="tc-side-info">
          ${W.sectorId ? `
          <div class="tc-side-field">
            <div class="tc-side-field-label">Setor</div>
            <div class="tc-side-field-value">${esc(sectors.find(s => s.id === W.sectorId)?.name ?? '—')}</div>
          </div>` : ''}
          <div class="tc-side-field">
            <div class="tc-side-field-label">Criado por</div>
            <div class="tc-side-field-value">
              ${(() => { const u = users.find(x => x.id === W.createdById); return u ? `<span class="tc-avatar">${esc(initials(u))}</span> ${esc(u.name)}` : '—'; })()}
            </div>
          </div>
          <div class="tc-side-field">
            <div class="tc-side-field-label">Responsável</div>
            <div id="dd-resp-container"></div>
          </div>
        </div>

        <div class="tc-side-head">
          <span class="tc-section-icon">${icon('comment', 18)}</span>
          <span class="tc-side-title">Comentários e atividade</span>
          <button class="tc-btn tc-btn-sm" id="dd-activity-toggle">Ocultar Detalhes</button>
        </div>
        <div class="tc-comment-box tc-edit-only">
          <textarea class="tc-comment-input" id="dd-comment" rows="1" placeholder="Escrever um comentário..."></textarea>
          <div class="tc-comment-actions" id="dd-comment-actions">
            <button class="tc-btn tc-btn-primary tc-btn-sm" id="dd-comment-save">Salvar</button>
            <span class="tc-hint">Ctrl+Enter para enviar</span>
          </div>
        </div>
        <div class="tc-feed" id="dd-feed"></div>
      </aside>
    </div>
  `, 'tc-detail');

  const $ = id => document.getElementById(id);
  const root = $('_modal');
  root.classList.toggle('tc-is-done', W.status === 'Concluído');
  root.classList.toggle('tc-readonly', readOnly);
  if (localDescription !== null) markDirty();

  // ════════════════════════════════════════════════
  // Attach events
  // ════════════════════════════════════════════════

  $('dd-close').onclick = async () => {
    closeModal();
    if (onSave) await onSave();
  };

  // ── Responsible user dropdown ──
  const respSelect = createSearchableSelect({
    options: [
      { value: '', label: 'Sem responsável' },
      ...users.map(u => ({ value: u.id, label: u.name })),
    ],
    value: responsibleOf(W) ?? '',
    placeholder: 'Sem responsável',
    searchPlaceholder: 'Filtrar por nome...',
    onChange: (val) => {
      const oldId = responsibleOf(W) ?? '';
      if (val === oldId) return;
      const oldUser = users.find(u => u.id === oldId);
      const newUser = users.find(u => u.id === val);
      W.responsibleId = val || null;
      const comment = {
        id: generateId('cmt'),
        userId: currentUser.id,
        text: `alterou o responsável de ${oldUser?.name ?? 'Sem responsável'} para ${newUser?.name ?? 'Sem responsável'}`,
        createdAt: new Date().toISOString(),
        isSystem: true,
      };
      W.comments = [...W.comments, comment];
      renderFeed();
      markDirty();
    },
    className: 'ss-wide',
  });
  $('dd-resp-container').appendChild(respSelect);

  // ── Name inline edit ──
  const nameView  = $('dd-name-view');
  const nameInput = $('dd-name-input');
  nameView.addEventListener('click', () => {
    if (readOnly) return;
    nameView.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.focus(); nameInput.select();
  });
  nameInput.addEventListener('blur', () => {
    const v = nameInput.value.trim();
    if (v && v !== W.name) { W.name = v; nameView.textContent = v; markDirty(); }
    nameView.style.display = 'block';
    nameInput.style.display = 'none';
  });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  nameInput.blur();
    if (e.key === 'Escape') { e.stopPropagation(); nameInput.value = W.name; nameInput.blur(); }
  });

  // ── Description (EasyMDE) ──
  const descView = $('dd-desc-view');
  const descEdit = $('dd-desc-edit');
  const descTa   = $('dd-desc-ta');
  const descBtn  = $('dd-desc-toggle');
  let ddDescEditor = null;

  function closeDescEditor() {
    if (ddDescEditor) { destroyAllEditors(); ddDescEditor = null; }
    descEdit.style.display = 'none'; descView.style.display = 'block';
    descBtn.style.display = '';
  }
  function openDescEditor() {
    descView.style.display = 'none'; descEdit.style.display = 'block';
    descBtn.style.display = 'none';
    // Init EasyMDE on the textarea
    if (!ddDescEditor) {
      ddDescEditor = initEditor(descTa, {
        placeholder: 'Escreva a descrição em Markdown...',
        minHeight: 180,
        autofocus: true,
      });
      ddDescEditor.codemirror.on('change', () => {
        W.description = ddDescEditor.value();
        saveDescriptionDraft(W.id, W.description);
        markDirty();
      });
    }
  }
  descBtn.addEventListener('click', openDescEditor);
  descView.addEventListener('click', e => { if (!readOnly && !e.target.closest('a')) openDescEditor(); });

  $('dd-desc-close').addEventListener('click', () => {
    descView.innerHTML = W.description ? renderMd(W.description) : descPlaceholder;
    closeDescEditor();
  });

  // ── Status (select + check circle) ──
  function applyStatus(status) {
    W.status = status;
    const sel = $('dd-status');
    sel.value = status;
    sel.className = `tc-chip-select tc-status-${slug(status)}`;
    const done = status === 'Concluído';
    root.classList.toggle('tc-is-done', done);
    if (done) {
      const today = todayISO();
      if (!W.endDate)   { W.endDate   = today; $('dd-end').value   = today; }
      if (!W.startDate) { W.startDate = today; $('dd-start').value = today; }
      W.completionPercent = 100;
      $('dd-pct').value = 100; $('dd-pct-lbl').textContent = '100%';
    }
    markDirty();
  }
  $('dd-status').addEventListener('change', e => applyStatus(e.target.value));
  $('dd-check').addEventListener('click', () =>
    applyStatus(W.status === 'Concluído' ? 'Para Fazer' : 'Concluído'));

  // ── Priority chip ──
  $('dd-priority').addEventListener('change', e => {
    W.priority = e.target.value;
    e.target.className = `tc-chip-select tc-prio-${slug(W.priority)}`;
    markDirty();
  });

  // ── Activity type → categories ──
  if (!isSub) {
    $('dd-at').addEventListener('change', e => {
      W.activityTypeId = e.target.value;
      const cats = catsFor(W.activityTypeId);
      $('dd-cat').innerHTML = catOptions(cats, cats[0]?.id ?? '');
      W.categoryId = cats[0]?.id ?? '';
      markDirty();
    });
  }

  // ── Generic field listeners ──
  const simpleFields = {
    'dd-cat':      'categoryId',
    'dd-deadline': 'deadline',
    'dd-start':    'startDate',
    'dd-end':      'endDate',
    'dd-req':      'requesterId',
  };
  Object.entries(simpleFields).forEach(([id, field]) => {
    $(id)?.addEventListener('change', e => { W[field] = e.target.value || null; markDirty(); });
  });
  $('dd-hours').addEventListener('change', e => {
    W.hoursInvested = parseFloat(e.target.value) || null;
    hoursEdited = true;
    markDirty();
  });

  $('dd-pct').addEventListener('input', e => {
    W.completionPercent = parseInt(e.target.value);
    updateCompletionSlider(e.target, $('dd-pct-lbl'));
    markDirty();
  });

  // ── Checklist ──
  function renderChecklist() {
    const items = W.checklist;
    const done  = items.filter(i => i.done).length;
    const pct   = items.length ? Math.round(done / items.length * 100) : 0;
    $('dd-check-sec').style.display = items.length || $('dd-check-sec').dataset.open ? 'block' : 'none';
    $('dd-check-count').textContent = items.length ? `${done}/${items.length}` : '';
    $('dd-check-pct').textContent = pct + '%';
    $('dd-check-bar').style.width = pct + '%';
    $('dd-check-bar').classList.toggle('full', pct === 100);
    $('dd-check-list').innerHTML = items.map(i => `
      <label class="tc-check-item ${i.done ? 'done' : ''}" data-id="${i.id}">
        <input type="checkbox" ${i.done ? 'checked' : ''} />
        <span class="tc-check-text">${esc(i.text)}</span>
        <button class="tc-icon-btn tc-check-del tc-edit-only" title="Remover">✕</button>
      </label>`).join('');
  }

  $('dd-check-list').addEventListener('change', e => {
    const item = W.checklist.find(i => i.id === e.target.closest('.tc-check-item')?.dataset.id);
    if (!item) return;
    item.done = e.target.checked;
    renderChecklist(); markDirty();
  });
  $('dd-check-list').addEventListener('click', e => {
    if (!e.target.closest('.tc-check-del')) return;
    e.preventDefault();
    const id = e.target.closest('.tc-check-item').dataset.id;
    W.checklist = W.checklist.filter(i => i.id !== id);
    renderChecklist(); markDirty();
  });

  function addChecklistItem() {
    const input = $('dd-check-input');
    const text = input.value.trim();
    if (!text) return;
    W.checklist.push({ id: generateId('chk'), text, done: false });
    input.value = '';
    renderChecklist(); markDirty();
    input.focus();
  }
  $('dd-check-add-btn').addEventListener('click', addChecklistItem);
  $('dd-check-input').addEventListener('keydown', e => { if (e.key === 'Enter') addChecklistItem(); });
  $('dd-add-check').addEventListener('click', () => {
    $('dd-check-sec').dataset.open = '1';
    renderChecklist();
    $('dd-check-input').focus();
  });
  renderChecklist();

  // ── Comments & activity feed ──
  function renderFeed() {
    const entries = W.comments.map(c => ({ ...c, kind: c.isSystem ? 'activity' : 'comment' }));
    if (showActivity) {
      entries.push({ kind: 'activity', userId: W.createdById, createdAt: W.createdAt,
        text: `criou ${isSub ? 'esta sub-tarefa' : 'esta tarefa'}` });
      if (W.updatedAt && W.updatedAt !== W.createdAt) {
        entries.push({ kind: 'activity', userId: null, createdAt: W.updatedAt, text: 'Última atualização da tarefa' });
      }
    }
    entries.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    $('dd-feed').innerHTML = entries.length ? entries.map(e => {
      const u = users.find(x => x.id === e.userId);
      const avatar = `<span class="tc-avatar">${u ? esc(initials(u)) : icon('info', 14)}</span>`;
      if (e.kind === 'activity') {
        return `
          <div class="tc-feed-item">
            ${avatar}
            <div class="tc-feed-content">
              <div>${u ? `<strong>${esc(u.name)}</strong> ` : ''}${esc(e.text)}</div>
              <div class="tc-feed-date">${formatDatetime(e.createdAt)}</div>
            </div>
          </div>`;
      }
      return `
        <div class="tc-feed-item">
          ${avatar}
          <div class="tc-feed-content">
            <div><strong>${esc(u?.name ?? 'Usuário')}</strong> <span class="tc-feed-date">${formatDatetime(e.createdAt)}</span></div>
            <div class="tc-comment-bubble">${esc(e.text).replace(/\n/g, '<br>')}</div>
          </div>
        </div>`;
    }).join('') : '<div class="tc-empty">Nenhum comentário.</div>';
  }

  const commentInput = $('dd-comment');
  commentInput.addEventListener('focus', () => { $('dd-comment-actions').style.display = 'flex'; commentInput.rows = 3; });
  commentInput.addEventListener('blur', () => {
    if (!commentInput.value.trim()) { $('dd-comment-actions').style.display = 'none'; commentInput.rows = 1; }
  });

  async function saveComment() {
    const text = commentInput.value.trim();
    if (!text) return;
    const comment = { id: generateId('cmt'), userId: currentUser.id, text, createdAt: new Date().toISOString() };
    const btn = $('dd-comment-save');
    btn.disabled = true;
    try {
      const saved = await getTasks();
      const current = saved.find(t => t.id === W.id);
      const comments = [...(current?.comments ?? []), comment];
      await updateTask(W.id, { comments });
      W.comments = comments;
      commentInput.value = '';
      commentInput.blur();
      renderFeed();
    } catch (err) {
      showToast('Erro ao comentar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }
  $('dd-comment-save').addEventListener('mousedown', e => e.preventDefault());
  $('dd-comment-save').addEventListener('click', saveComment);
  commentInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) saveComment();
    if (e.key === 'Escape') { e.stopPropagation(); commentInput.value = ''; commentInput.blur(); }
  });

  $('dd-activity-toggle').addEventListener('click', e => {
    showActivity = !showActivity;
    e.target.textContent = showActivity ? 'Ocultar Detalhes' : 'Mostrar Detalhes';
    renderFeed();
  });
  renderFeed();

  // ── Save ──
  $('dd-save').addEventListener('click', async () => {
    // Sem edição manual das horas, grava o valor mais novo do timer
    // (evita sobrescrever com o valor de quando o detalhe foi aberto).
    const capturedAt = Date.now();
    if (!hoursEdited) {
      const fromTimer = timerHoursFor(W.id, openedAt);
      if (fromTimer) W.hoursInvested = fromTimer.hours;
    }

    // Validate completed task
    if (W.status === 'Concluído' && !isSub) {
      if (!(W.hoursInvested > 0) || !W.startDate || !W.endDate) {
        setErr('dd-hours', !(W.hoursInvested > 0));
        setErr('dd-start', !W.startDate);
        setErr('dd-end',   !W.endDate);
        showToast('Preencha Horas Investidas, Data de Início e Data de Conclusão para concluir.', 'error');
        return;
      }
    }

    // Subtask hours guard
    if (isSub && W.hoursInvested) {
      const parent = allTasks.find(t => t.id === W.parentId);
      if (parent?.hoursInvested && W.hoursInvested > parent.hoursInvested) {
        showToast('Horas da sub-tarefa não podem exceder as da tarefa pai (' + parent.hoursInvested + 'h).', 'error');
        return;
      }
    }

    const btn = $('dd-save');
    btn.disabled = true; btn.textContent = 'Salvando...';

    try {
      const updated = await updateTask(W.id, W);
      syncTimerHours(W.id, W.hoursInvested, capturedAt);   // o timer passa a contar deste valor
      hoursEdited = false;
      clearDescriptionDraft(W.id);
      W.updatedAt = updated.updatedAt;
      ['dd-hours', 'dd-start', 'dd-end'].forEach(id => setErr(id, false));
      btn.style.display = 'none';
      btn.disabled = false; btn.innerHTML = `${icon('save', 13)} Salvar`;
      renderFeed();
      showToast('Tarefa atualizada!', 'success');
      if (onSave) await onSave();
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'error');
      btn.disabled = false; btn.innerHTML = `${icon('save', 13)} Salvar`;
    }
  });

  $('dd-delete').addEventListener('click', async () => {
    $('dd-delete-action').style.display = 'none';
    $('dd-delete-confirm').style.display = 'block';
    $('dd-delete-input').focus();
  });

  $('dd-delete-input').addEventListener('input', e => {
    $('dd-delete-confirm-btn').disabled = e.target.value.trim().toLowerCase() !== 'excluir';
  });

  $('dd-delete-cancel').addEventListener('click', () => {
    $('dd-delete-input').value = '';
    $('dd-delete-confirm-btn').disabled = true;
    $('dd-delete-confirm').style.display = 'none';
    $('dd-delete-action').style.display = 'block';
  });

  $('dd-delete-confirm-btn').addEventListener('click', async () => {
    const btn = $('dd-delete-confirm-btn');
    btn.disabled = true;
    try {
      await deleteTask(W.id);
      clearDescriptionDraft(W.id);
      showToast('Tarefa excluída!', 'success');
      if (onSave) await onSave();
      else closeModal();
    } catch (err) {
      showToast('Erro ao excluir: ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  // ── Timer do menu: horas ao vivo + gravar ao fechar o detalhe ──
  function paintTimerHours() {
    const live = timerHoursFor(W.id);
    const hint = $('dd-hours-live');
    if (!live?.live) { hint.textContent = ''; return; }
    hint.textContent = `⏱ Timer rodando — ${formatDuration(live.hours * 3600)}`;
    const input = $('dd-hours');
    if (!hoursEdited && document.activeElement !== input) input.value = round2(live.hours);
  }
  const stopTimerTick = onTimerTick(() => {
    if (!root.isConnected) {          // detalhe fechado (X, Esc, fundo ou troca de modal)
      stopTimerTick();
      commitTimerIfActive(W.id);
      return;
    }
    paintTimerHours();
  });
  paintTimerHours();

  // ── Modo visualização: bloqueia todos os campos ──
  if (readOnly) {
    root.querySelectorAll('.tc-topbar-left select, .tc-main input, .tc-main select, .tc-main textarea, #dd-check, #dd-resp-container button')
      .forEach(el => { el.disabled = true; });
  }

  // ── Add subtask ──
  $('dd-add-sub')?.addEventListener('click', () => {
    closeModal();
    openCreateTask(async () => {
      const fresh = await getTasks();
      const t = fresh.find(x => x.id === task.id);
      if (t) openTaskDetail(t, onSave);
      if (onSave) await onSave();
    }, W.id, { activityTypeId: W.activityTypeId, categoryId: W.categoryId, sectorId: W.sectorId });
  });

  // ── Subtask click ──
  document.querySelectorAll('.subtask-item').forEach(item => {
    item.addEventListener('click', async () => {
      const fresh = await getTasks();
      const sub   = fresh.find(t => t.id === item.dataset.id);
      if (!sub) return;
      closeModal();
      openTaskDetail(sub, async () => {
        const rf = await getTasks();
        const parent = rf.find(t => t.id === task.id);
        if (parent) openTaskDetail(parent, onSave);
        if (onSave) await onSave();
      });
    });
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') item.click(); });
  });
}

// ═══════════════════════════════════════════════════════════
// CONFIRM MODAL — resolve(true) ao confirmar, resolve(false) ao sair
// ═══════════════════════════════════════════════════════════

export function openConfirm({
  title, message, confirmLabel = 'Confirmar', danger = false, requiredText = '',
}) {
  return new Promise(resolve => {
    openShell(`
      <div class="tc-topbar">
        <div class="tc-topbar-left">
          <span class="tc-section-icon">${icon(danger ? 'warn' : 'info', 20)}</span>
          <span class="tc-section-title">${esc(title)}</span>
        </div>
        <div class="tc-topbar-right">
          <button class="tc-icon-btn" id="cf-close" title="Fechar">✕</button>
        </div>
      </div>
      <div class="tc-body tc-body-single">
        <div class="tc-main">
          <p class="tc-confirm-text">${message}</p>
          ${requiredText ? `
            <label class="tc-confirm-label" for="cf-confirmation">Digite "${esc(requiredText)}" para confirmar</label>
            <input class="tc-input tc-confirm-input" id="cf-confirmation" type="text" autocomplete="off" />
          ` : ''}
        </div>
      </div>
      <div class="tc-footer">
        <button class="tc-btn" id="cf-no">Cancelar</button>
        <button class="tc-btn ${danger ? 'tc-btn-danger' : 'tc-btn-primary'}" id="cf-yes" ${requiredText ? 'disabled' : ''}>${esc(confirmLabel)}</button>
      </div>
    `, 'tc-confirm');

    const onKey = e => { if (e.key === 'Escape') done(false); };

    function done(value) {
      document.removeEventListener('keydown', onKey);
      closeModal();
      resolve(value);
    }

    document.addEventListener('keydown', onKey);
    document.getElementById('modal-backdrop').onclick = () => done(false);
    document.getElementById('cf-close').onclick = () => done(false);
    document.getElementById('cf-no').onclick    = () => done(false);
    const confirmButton = document.getElementById('cf-yes');
    confirmButton.onclick = () => done(true);
    if (requiredText) {
      const confirmation = document.getElementById('cf-confirmation');
      confirmation.addEventListener('input', () => {
        confirmButton.disabled = confirmation.value.trim().toLowerCase() !== requiredText.toLowerCase();
      });
      confirmation.focus();
    } else {
      confirmButton.focus();
    }
  });
}
