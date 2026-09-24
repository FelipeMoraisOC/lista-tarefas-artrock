// ── Dashboard view ────────────────────────────────────────

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { renderPie, renderBar } from '../components/chart.js';
import { formatDate, isOverdue } from '../utils.js';

const DESCRIPTION_DRAFT_PREFIX = 'artrock:task-description-draft:';

function hasDescriptionDraft(taskId) {
  return localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}${taskId}`) !== null;
}

function priorityBadge(p) {
  return `<span class="badge badge-priority-${p.toLowerCase()}">${p}</span>`;
}
function statusBadge(s) {
  return `<span class="badge badge-status-${s.toLowerCase().replace(/ /g,'-')}">${s}</span>`;
}

function taskCard(task, categories, users) {
  const cat      = categories.find(c => c.id === task.categoryId);
  const req      = users.find(u => u.id === task.requesterId);
  const overdue  = isOverdue(task.deadline, task.status);
  const pct      = task.completionPercent ?? 0;
  const completionClass = pct >= 100 ? ' complete' : '';
  const hasDraft = hasDescriptionDraft(task.id);

  return `
    <div class="task-card${overdue ? ' overdue' : ''}" data-id="${task.id}" role="button" tabindex="0">
      <div class="task-card-head">
        <span class="task-card-name">${task.name}</span>
        ${priorityBadge(task.priority)}
      </div>
      ${hasDraft ? '<div class="task-draft-note">📝 Descrição da tarefa não está salva</div>' : ''}
      <div class="task-card-meta">
        ${statusBadge(task.status)}
        ${cat ? `<span class="badge badge-cat">${cat.name}</span>` : ''}
      </div>
      ${pct > 0 ? `
        <div class="prog-wrap"><div class="prog-fill${completionClass}" style="width:${pct}%"></div></div>
        <span class="prog-label">${pct}% concluído</span>
      ` : ''}
      <div class="task-card-foot">
        <span class="deadline${overdue ? ' overdue' : ''}">
          📅 ${formatDate(task.deadline)}
        </span>
        ${req ? `<span class="text-muted text-small">👤 ${req.name}</span>` : ''}
      </div>
    </div>`;
}

export async function initDashboard(container) {
  const [tasks, users, categories, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getCurrentUser(),
  ]);

  const mine = tasks.filter(t => t.type === 'task' && (t.responsibleId ?? t.createdById) === currentUser.id);

  const inProgress = mine.filter(t => t.status === 'Em Andamento');
  const upcoming   = mine.filter(t => t.status === 'Para Fazer')
                         .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
                         .slice(0, 5);

  const cntTodo    = mine.filter(t => t.status === 'Para Fazer').length;
  const cntProg    = inProgress.length;
  const cntDone    = mine.filter(t => t.status === 'Concluído').length;
  const totalHours = mine.reduce((s, t) => s + (t.hoursInvested ?? 0), 0);

  container.innerHTML = `
    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Para Fazer</div>
        <div class="stat-value">${cntTodo}</div>
        <div class="stat-sub">tarefas pendentes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Em Andamento</div>
        <div class="stat-value blue">${cntProg}</div>
        <div class="stat-sub">tarefas ativas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Concluídas</div>
        <div class="stat-value green">${cntDone}</div>
        <div class="stat-sub">${totalHours}h investidas</div>
      </div>
    </div>

    <!-- Two-column grid -->
    <div class="dash-grid">
      <div class="dash-left">
        <div class="section-wrap">
          <div class="section-header">
            <span class="section-title">🔄 Em Andamento</span>
            <span class="badge badge-status-em-andamento">${cntProg}</span>
          </div>
          <div class="task-list" id="dash-inprogress">
            ${inProgress.length
              ? inProgress.map(t => taskCard(t, categories, users)).join('')
              : '<div class="task-list-empty">Nenhuma tarefa em andamento ⚠️</div>'}
          </div>
        </div>

        <div class="section-wrap">
          <div class="section-header">
            <span class="section-title">⏰ Próximos Prazos</span>
            <span class="badge badge-count">${upcoming.length}</span>
          </div>
          <div class="task-list" id="dash-upcoming">
            ${upcoming.length
              ? upcoming.map(t => taskCard(t, categories, users)).join('')
              : '<div class="task-list-empty">Sem tarefas pendentes com prazo próximo.</div>'}
          </div>
        </div>
      </div>

      <div class="dash-right">
        <div class="section-wrap">
          <div class="section-header">
            <span class="section-title">📊 Horas por Categoria</span>
          </div>
          <div class="chart-wrap" style="height:240px">
            <canvas id="pieChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Bar chart -->
    <div class="section-wrap">
      <div class="section-header">
        <span class="section-title">📊 Horas por Dia</span>
        <span class="text-muted text-small">Últimos 14 dias</span>
      </div>
      <div class="chart-wrap" style="height:220px">
        <canvas id="barChart"></canvas>
      </div>
    </div>
  `;

  // Charts
  renderPie(document.getElementById('pieChart'), tasks, categories, currentUser.id);
  renderBar(document.getElementById('barChart'), tasks, categories, currentUser.id);

  // Task card clicks
  container.querySelectorAll('.task-card').forEach(card => {
    const open = () => {
      const t = tasks.find(x => x.id === card.dataset.id);
      if (t) import('./modals.js').then(m => m.openTaskDetail(t, () => initDashboard(container)));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}
