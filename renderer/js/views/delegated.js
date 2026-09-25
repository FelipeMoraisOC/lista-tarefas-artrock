// ── Tarefas Delegadas view ─────────────────────────────────
//
// Shows tasks created by the current user (createdById)
// but assigned to someone else (responsibleId ≠ currentUser.id).

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { createTaskFilter, applyFilters } from '../components/task-filter.js';
import { renderTaskCards } from '../components/task-card.js';

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

    renderTaskCards(grid, list, {
      categories,
      activityTypes,
      users,
      person: 'responsible',
      emptyHtml: `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Nenhuma tarefa encontrada</div>
          <div class="empty-desc">Altere os filtros ou delegue uma tarefa a outro usuário.</div>
        </div>`,
      async onOpen(id) {
        const fresh = await getTasks();
        const t = fresh.find(x => x.id === id);
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
      },
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

  renderList();
}
