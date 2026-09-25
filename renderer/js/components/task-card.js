// ── Task card component ───────────────────────────────────
//
// Padrão único de card de tarefa usado em todas as listagens
// (Dashboard, Minhas Tarefas, Tarefas Delegadas).

import { formatDate, isOverdue } from '../utils.js';

const DESCRIPTION_DRAFT_PREFIX = 'artrock:task-description-draft:';

function hasDescriptionDraft(taskId) {
  return localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}${taskId}`) !== null;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function priorityBadge(p) {
  if (!p) return '';
  return `<span class="badge badge-priority-${esc(p.toLowerCase())}">${esc(p)}</span>`;
}

function statusBadge(s) {
  if (!s) return '';
  return `<span class="badge badge-status-${esc(s.toLowerCase().replace(/ /g, '-'))}">${esc(s)}</span>`;
}

/**
 * Renderiza o HTML de um card de tarefa.
 *
 * @param {object} task
 * @param {object} ctx
 * @param {Array}  ctx.categories
 * @param {Array}  ctx.activityTypes
 * @param {Array}  ctx.users
 * @param {'requester'|'responsible'} [ctx.person='requester'] Qual pessoa exibir no rodapé
 */
export function taskCard(task, { categories = [], activityTypes = [], users = [], person = 'requester' } = {}) {
  const cat = categories.find(c => c.id === task.categoryId);
  const at  = activityTypes.find(a => a.id === task.activityTypeId);
  const who = users.find(u => u.id === (person === 'responsible' ? task.responsibleId : task.requesterId));

  const ov  = isOverdue(task.deadline, task.status);
  const pct = task.completionPercent ?? 0;
  const completionClass = pct >= 100 ? 'complete' : 'in-progress';

  return `
    <div class="task-card${ov ? ' overdue' : ''}" data-id="${esc(task.id)}" role="button" tabindex="0">
      <div class="task-card-head">
        <span class="task-card-name">${esc(task.name)}</span>
        ${priorityBadge(task.priority)}
      </div>
      ${hasDescriptionDraft(task.id) ? '<div class="task-draft-note">📝 Descrição da tarefa não está salva</div>' : ''}
      <div class="task-card-meta">
        ${statusBadge(task.status)}
        <span class="badge completion-badge ${completionClass}">${pct}%</span>
        ${at  ? `<span class="badge badge-subtask">${esc(at.name)}</span>` : ''}
        ${cat ? `<span class="badge badge-cat">${esc(cat.name)}</span>` : ''}
      </div>
      <div class="task-card-dates">
        <span class="task-date deadline${ov ? ' overdue' : ''}" title="Prazo de entrega">${ov ? '⏰' : '📅'} ${formatDate(task.deadline)}</span>
        ${task.startDate ? `<span class="task-date" title="Data de início">🚀 ${formatDate(task.startDate)}</span>` : ''}
        ${task.endDate   ? `<span class="task-date" title="Data de conclusão">🏁 ${formatDate(task.endDate)}</span>` : ''}
      </div>
      ${who ? `<div class="task-card-foot"><span class="text-muted text-small">👤 ${esc(who.name)}</span></div>` : ''}
    </div>`;
}

/**
 * Renderiza uma lista de cards e liga o clique/teclado de cada um.
 *
 * @param {HTMLElement} container Elemento que receberá os cards
 * @param {Array} tasks
 * @param {object} ctx Mesmo contexto de `taskCard`, mais:
 * @param {(taskId: string) => void} ctx.onOpen Chamado ao clicar/ativar um card
 * @param {string} [ctx.emptyHtml] HTML exibido quando a lista está vazia
 */
export function renderTaskCards(container, tasks, { onOpen, emptyHtml, ...ctx } = {}) {
  if (!container) return;

  if (!tasks.length) {
    container.innerHTML = emptyHtml ?? '';
    return;
  }

  container.innerHTML = tasks.map(t => taskCard(t, ctx)).join('');

  if (!onOpen) return;
  container.querySelectorAll('.task-card').forEach(card => {
    const open = () => onOpen(card.dataset.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}
