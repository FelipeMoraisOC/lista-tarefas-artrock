// ── Dashboard view ────────────────────────────────────────

import { getTasks, getUsers, getCategories, getActivityTypes, getCurrentUser } from '../store.js';
import { renderPie, renderBar } from '../components/chart.js';
import { renderTaskCards } from '../components/task-card.js';
import { responsibleOf } from '../utils.js';

export async function initDashboard(container) {
  const [tasks, users, categories, activityTypes, currentUser] = await Promise.all([
    getTasks(), getUsers(), getCategories(), getActivityTypes(), getCurrentUser(),
  ]);

  const mine = tasks.filter(t => t.type === 'task' && responsibleOf(t) === currentUser.id);

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
          <div class="task-list" id="dash-inprogress"></div>
        </div>

        <div class="section-wrap">
          <div class="section-header">
            <span class="section-title">⏰ Próximos Prazos</span>
            <span class="badge badge-count">${upcoming.length}</span>
          </div>
          <div class="task-list" id="dash-upcoming"></div>
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

  // Task lists
  const cardCtx = {
    categories,
    activityTypes,
    users,
    person: 'requester',
    onOpen(id) {
      const t = tasks.find(x => x.id === id);
      if (t) import('./modals.js').then(m => m.openTaskDetail(t, () => initDashboard(container)));
    },
  };

  renderTaskCards(document.getElementById('dash-inprogress'), inProgress, {
    ...cardCtx,
    emptyHtml: '<div class="task-list-empty">Nenhuma tarefa em andamento ⚠️</div>',
  });

  renderTaskCards(document.getElementById('dash-upcoming'), upcoming, {
    ...cardCtx,
    emptyHtml: '<div class="task-list-empty">Sem tarefas pendentes com prazo próximo.</div>',
  });
}
