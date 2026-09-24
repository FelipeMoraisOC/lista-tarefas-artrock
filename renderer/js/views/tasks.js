// ── Minhas Tarefas view ───────────────────────────────────

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { formatDate, isOverdue } from '../utils.js';

function priorityBadge(p) {
  return `<span class="badge badge-priority-${p.toLowerCase()}">${p}</span>`;
}
function statusBadge(s) {
  return `<span class="badge badge-status-${s.toLowerCase().replace(/ /g,'-')}">${s}</span>`;
}

function taskCard(task, categories, activityTypes, users) {
  const cat = categories.find(c => c.id === task.categoryId);
  const at  = activityTypes.find(a => a.id === task.activityTypeId);
  const req = users.find(u => u.id === task.requesterId);
  const ov  = isOverdue(task.deadline, task.status);
  const pct = task.completionPercent ?? 0;

  return `
    <div class="task-card${ov ? ' overdue' : ''}" data-id="${task.id}" role="button" tabindex="0">
      <div class="task-card-head">
        <span class="task-card-name">${task.name}</span>
        ${priorityBadge(task.priority)}
      </div>
      <div class="task-card-meta">
        ${at  ? `<span class="badge badge-subtask">${at.name}</span>` : ''}
        ${cat ? `<span class="badge badge-cat">${cat.name}</span>` : ''}
      </div>
      ${pct > 0 ? `
        <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%"></div></div>
        <span class="prog-label">${pct}%</span>
      ` : ''}
      <div class="task-card-foot">
        <span class="deadline${ov ? ' overdue' : ''}">📅 ${formatDate(task.deadline)}</span>
        ${req ? `<span class="text-muted text-small">👤 ${req.name}</span>` : ''}
      </div>
    </div>`;
}

export async function initTasks(container) {
  let activeStatus = 'Para Fazer';
  let searchText   = '';
  let searchCol    = 'name';

  const [allTasks, users, categories, activityTypes, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getActivityTypes(), getCurrentUser(),
  ]);

  // Own tasks (not subtasks)
  let mine = allTasks.filter(t => t.type === 'task' && t.createdById === currentUser.id);

  function counts() {
    return {
      'Para Fazer':   mine.filter(t => t.status === 'Para Fazer').length,
      'Em Andamento': mine.filter(t => t.status === 'Em Andamento').length,
      'Concluído':    mine.filter(t => t.status === 'Concluído').length,
    };
  }

  function filtered() {
    return mine.filter(t => {
      if (t.status !== activeStatus) return false;
      if (!searchText.trim()) return true;
      const term = searchText.toLowerCase();
      if (searchCol === 'name')           return (t.name ?? '').toLowerCase().includes(term);
      if (searchCol === 'priority')       return (t.priority ?? '').toLowerCase().includes(term);
      if (searchCol === 'deadline')       return formatDate(t.deadline).includes(term);
      if (searchCol === 'categoryId') {
        const c = categories.find(x => x.id === t.categoryId);
        return (c?.name ?? '').toLowerCase().includes(term);
      }
      if (searchCol === 'activityTypeId') {
        const a = activityTypes.find(x => x.id === t.activityTypeId);
        return (a?.name ?? '').toLowerCase().includes(term);
      }
      return false;
    });
  }

  function renderGrid() {
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;
    const list = filtered();

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Nenhuma tarefa encontrada</div>
          <div class="empty-desc">Altere os filtros ou crie uma nova tarefa.</div>
        </div>`;
    } else {
      grid.innerHTML = list.map(t => taskCard(t, categories, activityTypes, users)).join('');
      grid.querySelectorAll('.task-card').forEach(card => {
        const open = async () => {
          // Refresh tasks from store (may have been modified)
          const fresh = await getTasks();
          const t = fresh.find(x => x.id === card.dataset.id);
          if (!t) return;
          const { openTaskDetail } = await import('./modals.js');
          openTaskDetail(t, async () => {
            // Refresh mine list
            const ft = await getTasks();
            mine = ft.filter(x => x.type === 'task' && x.createdById === currentUser.id);
            renderGrid();
          });
        };
        card.addEventListener('click', open);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
      });
    }
  }

  const cnt = counts();

  container.innerHTML = `
    <div class="tasks-toolbar">
      <div class="status-tabs">
        <button class="status-tab active" data-status="Para Fazer">
          Para Fazer <span class="badge badge-count" id="cnt-todo">${cnt['Para Fazer']}</span>
        </button>
        <button class="status-tab" data-status="Em Andamento">
          Em Andamento <span class="badge badge-status-em-andamento" id="cnt-prog">${cnt['Em Andamento']}</span>
        </button>
        <button class="status-tab" data-status="Concluído">
          Concluído <span class="badge badge-status-concluído" id="cnt-done">${cnt['Concluído']}</span>
        </button>
      </div>

      <div class="search-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" class="search-input" id="search-input" placeholder="Buscar tarefa..." />
        </div>
        <select class="filter-select" id="filter-col">
          <option value="name">Nome</option>
          <option value="categoryId">Categoria</option>
          <option value="activityTypeId">Tipo Atividade</option>
          <option value="priority">Prioridade</option>
          <option value="deadline">Prazo</option>
        </select>
      </div>
    </div>

    <div class="tasks-grid" id="tasks-grid"></div>
  `;

  renderGrid();

  // Tab switching
  container.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeStatus = tab.dataset.status;
      renderGrid();
    });
  });

  // Search & filter
  document.getElementById('search-input').addEventListener('input', e => {
    searchText = e.target.value;
    renderGrid();
  });
  document.getElementById('filter-col').addEventListener('change', e => {
    searchCol = e.target.value;
    renderGrid();
  });
}
