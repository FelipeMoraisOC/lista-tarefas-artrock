// ── Tarefas Delegadas view ─────────────────────────────────
//
// Shows tasks created by the current user (createdById)
// but assigned to someone else (responsibleId ≠ currentUser.id).

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { formatDate, isOverdue } from '../utils.js';
import { createTaskFilter, applyFilters } from '../components/task-filter.js';

function priorityBadge(p) {
  return `<span class="badge badge-priority-${p.toLowerCase()}">${p}</span>`;
}
function statusBadge(s) {
  return `<span class="badge badge-status-${s.toLowerCase().replace(/ /g, '-')}">${s}</span>`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function taskCard(task, categories, activityTypes, users) {
  const cat = categories.find(c => c.id === task.categoryId);
  const at  = activityTypes.find(a => a.id === task.activityTypeId);
  const responsible = users.find(u => u.id === task.responsibleId);
  const ov  = isOverdue(task.deadline, task.status);
  const pct = task.completionPercent ?? 0;
  const completionClass = pct >= 100 ? 'complete' : 'in-progress';

  return `
    <div class="task-card${ov ? ' overdue' : ''}" data-id="${task.id}" role="button" tabindex="0">
      <div class="task-card-head">
        <span class="task-card-name">${esc(task.name)}</span>
        ${priorityBadge(task.priority)}
      </div>
      <div class="task-card-meta">
        ${statusBadge(task.status)}
        <span class="badge completion-badge ${completionClass}">${pct}%</span>
        ${at  ? `<span class="badge badge-subtask">${esc(at.name)}</span>` : ''}
        ${cat ? `<span class="badge badge-cat">${esc(cat.name)}</span>` : ''}
      </div>
      <div class="task-card-foot">
        <span class="deadline${ov ? ' overdue' : ''}">📅 ${formatDate(task.deadline)}</span>
        ${responsible ? `<span class="text-muted text-small">👤 ${esc(responsible.name)}</span>` : ''}
      </div>
    </div>`;
}

export async function initDelegated(container) {
  const [allTasks, users, categories, activityTypes, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getActivityTypes(), getCurrentUser(),
  ]);

  let delegated = allTasks.filter(t =>
    t.type === 'task' &&
    t.createdById === currentUser.id &&
    t.responsibleId &&
    t.responsibleId !== currentUser.id
  );

  let filters = {};
  let sortBy  = 'deadline';
  let sortDir = 'asc';

  function sorted(list) {
    return [...list].sort((a, b) => {
      let va, vb;
      if (sortBy === 'deadline') {
        va = a.deadline ?? '9999-12-31';
        vb = b.deadline ?? '9999-12-31';
      } else if (sortBy === 'end') {
        va = a.endDate ?? '9999-12-31';
        vb = b.endDate ?? '9999-12-31';
      } else if (sortBy === 'start') {
        va = a.startDate ?? '9999-12-31';
        vb = b.startDate ?? '9999-12-31';
      }
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  function renderList() {
    const grid = document.getElementById('deleg-grid');
    if (!grid) return;

    const list = sorted(applyFilters(delegated, filters));

    document.getElementById('deleg-count').textContent = list.length;

    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Nenhuma tarefa encontrada</div>
          <div class="empty-desc">Altere os filtros ou delegue uma tarefa a outro usuário.</div>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(t => taskCard(t, categories, activityTypes, users)).join('');

    grid.querySelectorAll('.task-card').forEach(card => {
      const open = async () => {
        const fresh = await getTasks();
        const t = fresh.find(x => x.id === card.dataset.id);
        if (!t) return;
        const { openTaskDetail } = await import('./modals.js');
        openTaskDetail(t, async () => {
          const ft = await getTasks();
          delegated = ft.filter(x =>
            x.type === 'task' &&
            x.createdById === currentUser.id &&
            x.responsibleId &&
            x.responsibleId !== currentUser.id
          );
          filterPanel.clear();
          filters = {};
          renderList();
        });
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    });
  }

  // ── Build layout
  container.innerHTML = `
    <div class="deleg-layout">
      <div class="deleg-sidebar" id="deleg-sidebar"></div>
      <div class="deleg-main">
        <div class="deleg-toolbar">
          <span class="deleg-toolbar-count">
            Tarefas delegadas: <strong id="deleg-count">${delegated.length}</strong>
          </span>
          <div class="deleg-sort">
            <span class="tasks-sort-label">Ordenar por:</span>
            <div class="tasks-sort-buttons">
              <button type="button" class="sort-button active" data-sort="deadline">Prazo</button>
              <button type="button" class="sort-button" data-sort="end">Conclusão</button>
              <button type="button" class="sort-button" data-sort="start">Início</button>
            </div>
            <button type="button" class="sort-button sort-dir-btn" id="deleg-dir" title="Alternar direção">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M3 18h6v-2H3v2zm0-12v2h18V6H3zm0 7h12v-2H3v2z"/>
              </svg>
              <span id="deleg-dir-label">Crescente</span>
            </button>
          </div>
        </div>
        <div class="tasks-grid" id="deleg-grid"></div>
      </div>
    </div>
  `;

  // ── Filter panel
  const filterPanel = createTaskFilter({
    tasks: delegated,
    users,
    activityTypes,
    categories,
    onChange(f) {
      filters = f;
      renderList();
    },
  });
  document.getElementById('deleg-sidebar').appendChild(filterPanel);

  // ── Sort buttons
  container.querySelectorAll('.deleg-sort .sort-button[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      container.querySelectorAll('.deleg-sort .sort-button[data-sort]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      renderList();
    });
  });

  document.getElementById('deleg-dir').addEventListener('click', () => {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    document.getElementById('deleg-dir-label').textContent = sortDir === 'asc' ? 'Crescente' : 'Decrescente';
    renderList();
  });

  renderList();
}
