// ── Reusable Task Filter Component ─────────────────────────
//
// Returns a DOM element with collapsible date-range pickers
// and dropdown selects. Exposes .getFilters() and .clear().

export function createTaskFilter({ tasks, users, activityTypes, categories, onChange }) {
  const el = document.createElement('div');
  el.className = 'tf-card';

  const statusOpts  = ['Para Fazer', 'Em Andamento', 'Concluído'];
  const priorityOpts = ['Alta', 'Média', 'Baixa'];

  const relevantRequesters = (() => {
    const ids = new Set(tasks.map(t => t.requesterId).filter(Boolean));
    return users.filter(u => ids.has(u.id));
  })();

  const relevantATs = (() => {
    const ids = new Set(tasks.map(t => t.activityTypeId).filter(Boolean));
    return activityTypes.filter(a => ids.has(a.id));
  })();

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function dateSection(id, label) {
    return `
      <div class="tf-section" data-section="${id}">
        <button type="button" class="tf-section-toggle" data-toggle="${id}">
          <svg class="tf-chevron" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          <span>${label}</span>
        </button>
        <div class="tf-section-body tf-collapsed" id="tf-body-${id}">
          <div class="tf-date-row">
            <label class="tf-date-label">De</label>
            <input type="date" class="tf-date-input" id="tf-${id}-from" />
          </div>
          <div class="tf-date-row">
            <label class="tf-date-label">Até</label>
            <input type="date" class="tf-date-input" id="tf-${id}-to" />
          </div>
        </div>
      </div>`;
  }

  function selectSection(id, label, options) {
    return `
      <div class="tf-field">
        <label class="tf-field-label">${label}</label>
        <select class="tf-select" id="tf-${id}">
          <option value="">Todos</option>
          ${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
        </select>
      </div>`;
  }

  el.innerHTML = `
    <div class="tf-header">
      <span class="tf-title">Filtros</span>
    </div>

    <div class="tf-body">
      ${dateSection('deadline', 'Data de Entrega (Prazo)')}
      ${dateSection('start', 'Data de Início')}
      ${dateSection('end', 'Data de Conclusão')}

      ${selectSection('status', 'Status', statusOpts.map(s => ({ value: s, label: s })))}
      ${selectSection('priority', 'Prioridade', priorityOpts.map(p => ({ value: p, label: p })))}
      ${selectSection('requester', 'Solicitante', relevantRequesters.map(u => ({ value: u.id, label: u.name })))}
      ${selectSection('activityType', 'Tipo de Atividade', relevantATs.map(a => ({ value: a.id, label: a.name })))}

      <div class="tf-field" id="tf-category-wrap">
        <label class="tf-field-label">Categoria</label>
        <select class="tf-select" id="tf-category" disabled>
          <option value="">Selecione um tipo de atividade</option>
        </select>
      </div>
    </div>

    <div class="tf-footer">
      <button type="button" class="tf-btn tf-btn-clear" id="tf-clear">Limpar</button>
      <button type="button" class="tf-btn tf-btn-apply" id="tf-apply">Aplicar</button>
    </div>
  `;

  // ── Toggle collapsible sections
  el.querySelectorAll('.tf-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = el.querySelector(`#tf-body-${btn.dataset.toggle}`);
      body.classList.toggle('tf-collapsed');
      btn.classList.toggle('tf-open');
    });
  });

  // ── Category depends on activityType
  const atSelect  = () => el.querySelector('#tf-activityType');
  const catSelect = () => el.querySelector('#tf-category');

  function updateCategoryOptions() {
    const atId = atSelect().value;
    const sel  = catSelect();
    if (!atId) {
      sel.innerHTML = '<option value="">Selecione um tipo de atividade</option>';
      sel.disabled = true;
      return;
    }
    const relevantCatIds = new Set(
      tasks.filter(t => t.activityTypeId === atId).map(t => t.categoryId).filter(Boolean)
    );
    const cats = categories.filter(c => c.activityTypeId === atId && relevantCatIds.has(c.id));
    sel.innerHTML = `<option value="">Todas</option>${cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}`;
    sel.disabled = false;
  }

  setTimeout(() => {
    atSelect()?.addEventListener('change', updateCategoryOptions);

    el.querySelector('#tf-clear')?.addEventListener('click', () => {
      clear();
      onChange(getFilters());
    });

    el.querySelector('#tf-apply')?.addEventListener('click', () => {
      onChange(getFilters());
    });
  });

  function getFilters() {
    const val = id => el.querySelector(`#tf-${id}`)?.value || '';
    return {
      deadlineFrom:   val('deadline-from'),
      deadlineTo:     val('deadline-to'),
      startFrom:      val('start-from'),
      startTo:        val('start-to'),
      endFrom:        val('end-from'),
      endTo:          val('end-to'),
      status:         val('status'),
      priority:       val('priority'),
      requesterId:    val('requester'),
      activityTypeId: val('activityType'),
      categoryId:     val('category'),
    };
  }

  function clear() {
    el.querySelectorAll('.tf-date-input').forEach(i => { i.value = ''; });
    el.querySelectorAll('.tf-select').forEach(s => { s.value = ''; });
    updateCategoryOptions();
  }

  el.getFilters = getFilters;
  el.clear = clear;
  return el;
}

export function applyFilters(tasks, filters) {
  return tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.requesterId && t.requesterId !== filters.requesterId) return false;
    if (filters.activityTypeId && t.activityTypeId !== filters.activityTypeId) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;

    if (filters.deadlineFrom && (t.deadline ?? '') < filters.deadlineFrom) return false;
    if (filters.deadlineTo   && (t.deadline ?? '') > filters.deadlineTo)   return false;
    if (filters.startFrom && (t.startDate ?? '') < filters.startFrom) return false;
    if (filters.startTo   && (t.startDate ?? '') > filters.startTo)   return false;
    if (filters.endFrom && (t.endDate ?? '') < filters.endFrom) return false;
    if (filters.endTo   && (t.endDate ?? '') > filters.endTo)   return false;

    return true;
  });
}
