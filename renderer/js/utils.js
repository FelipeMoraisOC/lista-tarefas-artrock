// ── Shared utilities ──────────────────────────────────────

// `action` opcional: { label, onClick } — exibe um botão no toast (ex.: "Desfazer").
export function showToast(message, type = 'info', { action, duration = 3600 } = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] ?? 'ℹ'}</span><span>${message}</span>`;

  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
    setTimeout(() => el.remove(), 320);
  };

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { dismiss(); action.onClick(); }, { once: true });
    el.appendChild(btn);
  }

  container.appendChild(el);
  setTimeout(dismiss, duration);
}

// Horas decimais → "1,5h" (no máx. 2 casas)
export function formatHours(h) {
  return `${(Math.round((h ?? 0) * 100) / 100).toLocaleString('pt-BR')}h`;
}

// Segundos → "1:05:09" (ou "5:09" abaixo de 1 hora)
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function generateId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDatetime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Responsável efetivo da tarefa. Tarefas antigas sem o campo caem no criador;
// tarefas do Backlog podem ficar sem responsável (responsibleId === null).
export function responsibleOf(task) {
  if (!task) return null;
  return 'responsibleId' in task ? task.responsibleId : task.createdById;
}

export function isOverdue(deadline, status) {
  if (!deadline || status === 'Concluído') return false;
  return deadline < new Date().toISOString().split('T')[0];
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}
