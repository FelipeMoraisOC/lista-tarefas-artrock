// ── Minhas Tarefas view ───────────────────────────────────

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { formatDate } from '../utils.js';
import { renderTaskCards } from '../components/task-card.js';

export async function initTasks(container) {
  let activeStatus = 'Todas';
  let sortBy       = 'status';
  let searchText   = '';
  let searchCol    = 'name';

  const [allTasks, users, categories, activityTypes, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getActivityTypes(), getCurrentUser(),
  ]);

  // Tasks the current user is responsible for (fallback to createdById for legacy tasks)
  let mine = allTasks.filter(t => t.type === 'task' && (t.responsibleId ?? t.createdById) === currentUser.id);

  function counts() {
    return {
      Todas:          mine.length,
      'Para Fazer':   mine.filter(t => t.status === 'Para Fazer').length,
      'Em Andamento': mine.filter(t => t.status === 'Em Andamento').length,
      'Concluído':    mine.filter(t => t.status === 'Concluído').length,
    };
  }

  function updateCounts() {
    const currentCounts = counts();
    const countElements = {
      Todas: document.getElementById('cnt-all'),
      'Para Fazer': document.getElementById('cnt-todo'),
      'Em Andamento': document.getElementById('cnt-prog'),
      'Concluído': document.getElementById('cnt-done'),
    };

    Object.entries(countElements).forEach(([status, element]) => {
      if (element) element.textContent = currentCounts[status];
    });
  }

  function filtered() {
    const list = mine.filter(t => {
      if (activeStatus !== 'Todas' && t.status !== activeStatus) return false;
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

    const priorityOrder = { Alta: 0, Média: 1, Baixa: 2 };
    const statusOrder = { 'Para Fazer': 0, 'Em Andamento': 1, 'Concluído': 2 };
    const compareText = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

    return list.sort((a, b) => {
      let result = 0;
      if (sortBy === 'status') {
        result = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      } else if (sortBy === 'priority') {
        result = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      } else if (sortBy === 'deadline') {
        result = (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31');
      } else if (sortBy === 'requesterId') {
        const requesterA = users.find(u => u.id === a.requesterId)?.name ?? '';
        const requesterB = users.find(u => u.id === b.requesterId)?.name ?? '';
        result = compareText(requesterA, requesterB);
      }
      return result || compareText(a.name ?? '', b.name ?? '');
    });
  }

  function renderGrid() {
    const grid = document.getElementById('tasks-grid');
    if (!grid) return;
    updateCounts();
    const list = filtered();

    renderTaskCards(grid, list, {
      categories,
      activityTypes,
      users,
      person: 'requester',
      emptyHtml: `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Nenhuma tarefa encontrada</div>
          <div class="empty-desc">Altere os filtros ou crie uma nova tarefa.</div>
        </div>`,
      async onOpen(id) {
        // Refresh tasks from store (may have been modified)
        const fresh = await getTasks();
        const t = fresh.find(x => x.id === id);
        if (!t) return;
        const { openTaskDetail } = await import('./modals.js');
        openTaskDetail(t, async () => {
          // Refresh mine list
          const ft = await getTasks();
          mine = ft.filter(x => x.type === 'task' && (x.responsibleId ?? x.createdById) === currentUser.id);
          renderGrid();
        });
      },
    });
  }

  const cnt = counts();

  container.innerHTML = `
    <div class="tasks-toolbar">
      <div class="status-tabs">
        <button class="status-tab active" data-status="Todas">
          Todas <span class="badge badge-count" id="cnt-all">${cnt.Todas}</span>
        </button>
        <button class="status-tab" data-status="Em Andamento">
          Em Andamento <span class="badge badge-status-em-andamento" id="cnt-prog">${cnt['Em Andamento']}</span>
        </button>
        <button class="status-tab" data-status="Para Fazer">
          Para Fazer <span class="badge badge-count" id="cnt-todo">${cnt['Para Fazer']}</span>
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

    <div class="tasks-sort-toolbar">
      <span class="tasks-sort-label">Ordenar por:</span>
      <div class="tasks-sort-buttons">
        <button type="button" class="sort-button active" data-sort="status">Status</button>
        <button type="button" class="sort-button" data-sort="priority">Prioridade</button>
        <button type="button" class="sort-button" data-sort="deadline">Prazo</button>
        <button type="button" class="sort-button" data-sort="requesterId">Solicitante</button>
      </div>
      <div class="sort-help-wrap">
        <button type="button" class="sort-help-button" aria-label="Explicação dos ícones do card" aria-expanded="false">?</button>
        <div class="sort-help-popover" role="tooltip">
          <div class="sort-help-title">Legenda do card</div>
          <ul class="sort-help-list">
            <li><span>📅</span> Prazo em dia</li>
            <li><span>⏰</span> Prazo vencido</li>
            <li><span>🚀</span> Data de início</li>
            <li><span>🏁</span> Data de conclusão</li>
            <li><span>📝</span> Rascunho não salvo</li>
            <li><span>👤</span> Pessoa envolvida</li>
          </ul>
        </div>
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
      if (activeStatus !== 'Todas' && sortBy === 'status') {
        sortBy = 'priority';
      }
      container.querySelectorAll('.sort-button').forEach(sortButton => {
        sortButton.classList.toggle('active', sortButton.dataset.sort === sortBy);
        sortButton.classList.toggle('hidden', sortButton.dataset.sort === 'status' && activeStatus !== 'Todas');
      });
      renderGrid();
    });
  });

  container.querySelectorAll('.sort-button').forEach(sortButton => {
    sortButton.addEventListener('click', () => {
      if (sortButton.disabled) return;
      sortBy = sortButton.dataset.sort;
      container.querySelectorAll('.sort-button').forEach(button =>
        button.classList.toggle('active', button === sortButton)
      );
      renderGrid();
    });
  });

  const sortHelpWrap = container.querySelector('.sort-help-wrap');
  const sortHelpButton = container.querySelector('.sort-help-button');

  if (sortHelpButton && sortHelpWrap) {
    const closeHelp = () => {
      sortHelpWrap.classList.remove('open');
      sortHelpButton.setAttribute('aria-expanded', 'false');
    };

    sortHelpButton.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = sortHelpWrap.classList.contains('open');
      sortHelpWrap.classList.toggle('open', !isOpen);
      sortHelpButton.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', e => {
      if (!sortHelpWrap.contains(e.target)) {
        closeHelp();
      }
    });
  }

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
