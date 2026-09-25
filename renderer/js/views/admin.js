// ── Administração — CRUD de Tipos de Atividade e Categorias
// Acesso restrito aos usuários do setor "Admin".

import {
  getSectors, getActivityTypes, getCategories, getCurrentUser, getUsageCounts, isAdmin,
  createActivityType, updateActivityType, deleteActivityType,
  createCategory, updateCategory, deleteCategory, typeCoversSectors,
} from '../store.js';
import { openShell, closeModal, openConfirm, esc, icon } from './modals.js';
import { showToast } from '../utils.js';

const ALL = 'ALL';

// ── Acesso negado (usado aqui e pelo roteador) ────────────

export function renderAccessDenied(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🔒</div>
      <div class="empty-title">Acesso restrito</div>
      <div class="empty-desc">Esta área é exclusiva dos usuários do setor <strong>Admin</strong>.</div>
    </div>`;
}

// ── Helpers de apresentação ───────────────────────────────

function sectorName(id, sectors) {
  return sectors.find(s => s.id === id)?.name ?? id;
}

function sectorBadges(sectorIds, sectors) {
  if (!sectorIds?.length) return '<span class="text-muted text-small">—</span>';
  return sectorIds
    .map(id => `<span class="badge ${id === ALL ? 'badge-cat' : 'badge-subtask'}">${esc(sectorName(id, sectors))}</span>`)
    .join(' ');
}

function usageBadge(n) {
  return n
    ? `<span class="badge badge-count">${n}</span>`
    : '<span class="text-muted text-small">0</span>';
}

function rowActions(id, name) {
  return `
    <div class="adm-row-actions">
      <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${id}" title="Editar ${esc(name)}">
        ${icon('edit', 14)} Editar
      </button>
      <button class="btn btn-danger btn-sm" data-act="del" data-id="${id}" title="Excluir ${esc(name)}">
        ${icon('trash', 14)} Excluir
      </button>
    </div>`;
}

function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}"><div class="adm-empty">${esc(message)}</div></td></tr>`;
}

// ── Seletor de setores (checkboxes, com "TODOS" exclusivo) ─

function sectorPicker(sectors, selected) {
  const sel   = new Set(selected ?? []);
  const isAll = sel.has(ALL);

  return `
    <div class="adm-sector-grid" id="af-sectors">
      ${sectors.map(s => `
        <label class="adm-sector-item${s.id === ALL ? ' adm-sector-all' : ''}">
          <input type="checkbox" value="${s.id}"
            ${sel.has(s.id) ? 'checked' : ''}
            ${s.id !== ALL && isAll ? 'disabled' : ''} />
          <span>${esc(s.name)}${s.id === ALL ? ' <em>(todos os setores)</em>' : ''}</span>
        </label>`).join('')}
    </div>`;
}

function bindSectorPicker() {
  const wrap = document.getElementById('af-sectors');
  const all  = wrap.querySelector('input[value="ALL"]');
  if (!all) return;

  all.addEventListener('change', () => {
    wrap.querySelectorAll('input:not([value="ALL"])').forEach(cb => {
      cb.disabled = all.checked;
      if (all.checked) cb.checked = false;
    });
  });
}

function readSectors() {
  return [...document.querySelectorAll('#af-sectors input:checked')].map(cb => cb.value);
}

// ── Formulário: Tipo de Atividade ─────────────────────────

function openActivityTypeForm({ model, sectors, onDone }) {
  const isEdit = !!model;

  openShell(`
    <div class="tc-topbar">
      <div class="tc-topbar-left">
        <span class="tc-section-icon">${icon('list', 20)}</span>
        <span class="tc-section-title">${isEdit ? 'Editar Tipo de Atividade' : 'Novo Tipo de Atividade'}</span>
      </div>
      <div class="tc-topbar-right">
        <button class="tc-icon-btn" id="af-close" title="Fechar">✕</button>
      </div>
    </div>

    <div class="tc-body tc-body-single">
      <div class="tc-main">
        <div class="tc-field adm-form-field">
          <div class="tc-meta-label req">Nome</div>
          <input type="text" class="tc-input" id="af-name" autocomplete="off"
            placeholder="Ex: Reunião" value="${esc(model?.name ?? '')}" />
        </div>

        <div class="adm-form-field">
          <div class="tc-meta-label req">Setores com acesso</div>
          ${sectorPicker(sectors, model?.sectorIds)}
          <div class="tc-hint">Define quais setores podem usar este tipo ao criar tarefas.</div>
        </div>
      </div>
    </div>

    <div class="tc-footer">
      <button class="tc-btn" id="af-cancel">Cancelar</button>
      <button class="tc-btn tc-btn-primary" id="af-save">${icon('save', 15)} ${isEdit ? 'Salvar' : 'Criar'}</button>
    </div>
  `, 'tc-create');

  bindSectorPicker();
  const name = document.getElementById('af-name');
  name.focus();
  name.select();

  document.getElementById('af-close').onclick  = closeModal;
  document.getElementById('af-cancel').onclick = closeModal;

  document.getElementById('af-save').onclick = async () => {
    const btn = document.getElementById('af-save');
    const payload = { name: name.value, sectorIds: readSectors() };

    btn.disabled = true;
    try {
      if (isEdit) await updateActivityType(model.id, payload);
      else        await createActivityType(payload);
      closeModal();
      showToast(isEdit ? 'Tipo de atividade atualizado!' : 'Tipo de atividade criado!', 'success');
      await onDone();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  };
}

// ── Formulário: Categoria ─────────────────────────────────

function openCategoryForm({ model, sectors, types, presetTypeId, onDone }) {
  const isEdit = !!model;
  const atId   = model?.activityTypeId ?? presetTypeId ?? '';

  openShell(`
    <div class="tc-topbar">
      <div class="tc-topbar-left">
        <span class="tc-section-icon">${icon('tag', 20)}</span>
        <span class="tc-section-title">${isEdit ? 'Editar Categoria' : 'Nova Categoria'}</span>
      </div>
      <div class="tc-topbar-right">
        <button class="tc-icon-btn" id="af-close" title="Fechar">✕</button>
      </div>
    </div>

    <div class="tc-body tc-body-single">
      <div class="tc-main">
        <div class="tc-field adm-form-field">
          <div class="tc-meta-label req">Nome</div>
          <input type="text" class="tc-input" id="af-name" autocomplete="off"
            placeholder="Ex: Preparação" value="${esc(model?.name ?? '')}" />
        </div>

        <div class="adm-form-field">
          <div class="tc-meta-label req">Setores com acesso</div>
          ${sectorPicker(sectors, model?.sectorIds)}
          <div class="tc-hint">A categoria só aparece para usuários dos setores marcados.</div>
        </div>

        <div class="tc-field adm-form-field">
          <div class="tc-meta-label req">Tipo de Atividade</div>
          <select class="tc-input" id="af-at"></select>
          <div class="tc-hint" id="af-at-hint"></div>
        </div>
      </div>
    </div>

    <div class="tc-footer">
      <button class="tc-btn" id="af-cancel">Cancelar</button>
      <button class="tc-btn tc-btn-primary" id="af-save">${icon('save', 15)} ${isEdit ? 'Salvar' : 'Criar'}</button>
    </div>
  `, 'tc-create');

  bindSectorPicker();

  const name = document.getElementById('af-name');
  const at   = document.getElementById('af-at');
  const hint = document.getElementById('af-at-hint');

  // Mostra os setores do tipo escolhido — ajuda a manter a coerência.
  function updateHint() {
    const t = types.find(x => x.id === at.value);
    hint.textContent = t
      ? `Setores do tipo: ${t.sectorIds.map(id => sectorName(id, sectors)).join(', ')}`
      : '';
  }

  // Os setores marcados filtram os tipos disponíveis.
  function renderTypeOptions() {
    const secs = readSectors();
    const keep = at.value || atId;
    const opts = types.filter(t => typeCoversSectors(t, secs));

    if (!secs.length) {
      at.innerHTML = '<option value="">Selecione os setores primeiro...</option>';
      at.disabled  = true;
    } else if (!opts.length) {
      at.innerHTML = '<option value="">Nenhum tipo disponível para estes setores</option>';
      at.disabled  = true;
    } else {
      at.innerHTML = '<option value="">Selecione...</option>' + opts
        .map(t => `<option value="${t.id}" ${t.id === keep ? 'selected' : ''}>${esc(t.name)}</option>`)
        .join('');
      at.disabled  = false;
    }
    updateHint();
  }

  document.getElementById('af-sectors').addEventListener('change', renderTypeOptions);
  at.addEventListener('change', updateHint);
  renderTypeOptions();

  name.focus();
  name.select();

  document.getElementById('af-close').onclick  = closeModal;
  document.getElementById('af-cancel').onclick = closeModal;

  document.getElementById('af-save').onclick = async () => {
    const btn = document.getElementById('af-save');
    const payload = { name: name.value, activityTypeId: at.value, sectorIds: readSectors() };

    btn.disabled = true;
    try {
      if (isEdit) await updateCategory(model.id, payload);
      else        await createCategory(payload);
      closeModal();
      showToast(isEdit ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
      await onDone();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  };
}

// ── View ──────────────────────────────────────────────────

export async function initAdmin(container) {
  const currentUser = await getCurrentUser();
  if (!await isAdmin(currentUser)) { renderAccessDenied(container); return; }

  let tab          = 'types';   // 'types' | 'cats'
  let search       = '';
  let typeFilter   = '';        // filtro por tipo na aba Categorias
  let sectorFilter = '';        // filtro por setor (ambas as abas)
  let usageFilter  = '';        // '' | 'used' | 'unused'

  // Ordenação lembrada por aba — dir: 1 crescente, -1 decrescente
  const sort = {
    types: { key: 'name', dir: 1 },
    cats:  { key: 'name', dir: 1 },
  };

  const SORT_OPTIONS = {
    types: [
      { key: 'name',    label: 'Nome' },
      { key: 'sectors', label: 'Setores' },
      { key: 'cats',    label: 'Categorias' },
      { key: 'tasks',   label: 'Tarefas' },
    ],
    cats: [
      { key: 'name',    label: 'Nome' },
      { key: 'type',    label: 'Tipo de Atividade' },
      { key: 'sectors', label: 'Setores' },
      { key: 'tasks',   label: 'Tarefas' },
    ],
  };

  const NUMERIC_SORTS = new Set(['cats', 'tasks']);

  let sectors = [], types = [], cats = [], usage = { byActivityType: {}, byCategory: {} };

  async function reload() {
    [sectors, types, cats, usage] = await Promise.all([
      getSectors(), getActivityTypes(), getCategories(), getUsageCounts(),
    ]);
  }

  const matches = text => !search.trim() || String(text ?? '').toLowerCase().includes(search.trim().toLowerCase());

  const typeName    = id => types.find(t => t.id === id)?.name ?? '';
  const sectorsText = ids => (ids ?? []).map(id => sectorName(id, sectors)).join(', ');
  const catCount    = typeId => cats.filter(c => c.activityTypeId === typeId).length;
  const taskCount   = item => tab === 'types'
    ? (usage.byActivityType[item.id] ?? 0)
    : (usage.byCategory[item.id] ?? 0);

  function passesCommonFilters(item) {
    if (!matches(item.name)) return false;
    if (sectorFilter && !item.sectorIds?.includes(sectorFilter)) return false;
    if (usageFilter === 'used'   && !taskCount(item)) return false;
    if (usageFilter === 'unused' &&  taskCount(item)) return false;
    return true;
  }

  function sortRows(rows) {
    const { key, dir } = sort[tab];
    const cmpText = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    const value = item => {
      switch (key) {
        case 'sectors': return sectorsText(item.sectorIds);
        case 'type':    return typeName(item.activityTypeId);
        case 'cats':    return catCount(item.id);
        case 'tasks':   return taskCount(item);
        default:        return item.name ?? '';
      }
    };
    return [...rows].sort((a, b) => {
      const va = value(a), vb = value(b);
      const c  = typeof va === 'number' ? va - vb : cmpText(va, vb);
      return c * dir || cmpText(a.name ?? '', b.name ?? '');
    });
  }

  // ── Tabelas ──

  function typesTable() {
    const rows = sortRows(types.filter(passesCommonFilters));
    return `
      <table class="adm-table">
        <thead>
          <tr>
            <th>Tipo de Atividade</th>
            <th>Setores</th>
            <th class="adm-num">Categorias</th>
            <th class="adm-num">Tarefas</th>
            <th class="adm-actions-col"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(t => `
            <tr data-id="${t.id}">
              <td><span class="adm-name">${esc(t.name)}</span></td>
              <td>${sectorBadges(t.sectorIds, sectors)}</td>
              <td class="adm-num">${usageBadge(catCount(t.id))}</td>
              <td class="adm-num">${usageBadge(usage.byActivityType[t.id] ?? 0)}</td>
              <td class="adm-actions-col">${rowActions(t.id, t.name)}</td>
            </tr>`).join('')
          : emptyRow(5, 'Nenhum tipo de atividade encontrado.')}
        </tbody>
      </table>`;
  }

  function catsTable() {
    const rows = sortRows(cats.filter(c =>
      passesCommonFilters(c) && (!typeFilter || c.activityTypeId === typeFilter)
    ));
    return `
      <table class="adm-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Tipo de Atividade</th>
            <th>Setores</th>
            <th class="adm-num">Tarefas</th>
            <th class="adm-actions-col"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(c => {
            const t = types.find(x => x.id === c.activityTypeId);
            return `
              <tr data-id="${c.id}">
                <td><span class="adm-name">${esc(c.name)}</span></td>
                <td>${t
                  ? `<span class="badge badge-subtask">${esc(t.name)}</span>`
                  : `<span class="badge badge-priority-alta">tipo ausente</span>`}</td>
                <td>${sectorBadges(c.sectorIds, sectors)}</td>
                <td class="adm-num">${usageBadge(usage.byCategory[c.id] ?? 0)}</td>
                <td class="adm-actions-col">${rowActions(c.id, c.name)}</td>
              </tr>`;
          }).join('')
          : emptyRow(5, 'Nenhuma categoria encontrada.')}
        </tbody>
      </table>`;
  }

  // ── Ações de linha ──

  async function onEdit(id) {
    if (tab === 'types') {
      const model = types.find(t => t.id === id);
      if (model) openActivityTypeForm({ model, sectors, onDone: refresh });
    } else {
      const model = cats.find(c => c.id === id);
      if (model) openCategoryForm({ model, sectors, types, onDone: refresh });
    }
  }

  async function onDelete(id) {
    const isType = tab === 'types';
    const model  = isType ? types.find(t => t.id === id) : cats.find(c => c.id === id);
    if (!model) return;

    const linked = isType ? cats.filter(c => c.activityTypeId === id).length : 0;
    const used   = isType ? (usage.byActivityType[id] ?? 0) : (usage.byCategory[id] ?? 0);

    const ok = await openConfirm({
      title: isType ? 'Excluir tipo de atividade' : 'Excluir categoria',
      message: `
        Excluir <strong>${esc(model.name)}</strong> permanentemente?
        ${used   ? `<br /><span class="text-red">Em uso por ${used} tarefa(s) — a exclusão será bloqueada.</span>` : ''}
        ${linked ? `<br /><span class="text-red">Possui ${linked} categoria(s) vinculada(s) — a exclusão será bloqueada.</span>` : ''}`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;

    try {
      if (isType) await deleteActivityType(id);
      else        await deleteCategory(id);
      showToast(isType ? 'Tipo de atividade excluído.' : 'Categoria excluída.', 'success');
      await refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Render ──

  function renderBody() {
    const body = document.getElementById('adm-body');
    body.innerHTML = tab === 'types' ? typesTable() : catsTable();

    body.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () =>
        btn.dataset.act === 'edit' ? onEdit(btn.dataset.id) : onDelete(btn.dataset.id));
    });
  }

  function renderChrome() {
    const isTypes = tab === 'types';

    container.querySelectorAll('.status-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));

    document.getElementById('cnt-types').textContent = types.length;
    document.getElementById('cnt-cats').textContent  = cats.length;

    document.getElementById('search-input').placeholder =
      isTypes ? 'Buscar tipo de atividade...' : 'Buscar categoria...';

    document.getElementById('adm-new-label').textContent = isTypes ? 'Novo Tipo' : 'Nova Categoria';

    // Filtro por tipo só faz sentido na aba de categorias
    const filter = document.getElementById('adm-type-filter');
    filter.classList.toggle('hidden', isTypes);
    filter.innerHTML = `
      <option value="">Todos os tipos</option>
      ${types.map(t => `<option value="${t.id}" ${t.id === typeFilter ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`;

    document.getElementById('adm-sector-filter').innerHTML = `
      <option value="">Todos os setores</option>
      ${sectors.map(s => `<option value="${s.id}" ${s.id === sectorFilter ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;

    document.getElementById('adm-usage-filter').value = usageFilter;

    renderSortButtons();
    updateClearButton();
  }

  function renderSortButtons() {
    const { key, dir } = sort[tab];
    document.getElementById('adm-sort-buttons').innerHTML = SORT_OPTIONS[tab].map(o => `
      <button type="button" class="sort-button${o.key === key ? ' active' : ''}" data-sort="${o.key}"
        title="${o.key === key ? 'Clique para inverter a ordem' : `Ordenar por ${esc(o.label)}`}">
        ${esc(o.label)}${o.key === key ? (dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>`).join('');
  }

  function updateClearButton() {
    const active = search.trim() || typeFilter || sectorFilter || usageFilter;
    document.getElementById('adm-clear').classList.toggle('hidden', !active);
  }

  function onFiltersChanged() {
    updateClearButton();
    renderBody();
  }

  async function refresh() {
    await reload();
    renderChrome();
    renderBody();
  }

  await reload();

  container.innerHTML = `
    <div class="tasks-toolbar adm-toolbar">
      <div class="status-tabs">
        <button class="status-tab active" data-tab="types">
          Tipos de Atividade <span class="badge badge-count" id="cnt-types">0</span>
        </button>
        <button class="status-tab" data-tab="cats">
          Categorias <span class="badge badge-count" id="cnt-cats">0</span>
        </button>
      </div>

      <div class="search-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" class="search-input" id="search-input" placeholder="Buscar..." />
        </div>
        <button class="btn btn-primary btn-sm" id="adm-new">
          ${icon('plus', 15)} <span id="adm-new-label">Novo Tipo</span>
        </button>
      </div>
    </div>

    <div class="tasks-sort-toolbar adm-filter-toolbar">
      <div class="adm-filter-group">
        <span class="tasks-sort-label">Filtrar:</span>
        <select class="filter-select" id="adm-sector-filter" title="Filtrar por setor"></select>
        <select class="filter-select hidden" id="adm-type-filter" title="Filtrar por tipo de atividade"></select>
        <select class="filter-select" id="adm-usage-filter" title="Filtrar por uso em tarefas">
          <option value="">Uso: todos</option>
          <option value="used">Em uso</option>
          <option value="unused">Sem uso</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm hidden" id="adm-clear">Limpar filtros</button>
      </div>

      <div class="adm-filter-group">
        <span class="tasks-sort-label">Ordenar por:</span>
        <div class="tasks-sort-buttons" id="adm-sort-buttons"></div>
      </div>
    </div>

    <div class="adm-hint">
      Tipos de atividade e categorias definem as opções disponíveis ao criar tarefas.
      Itens já usados por tarefas não podem ser excluídos.
    </div>

    <div id="adm-body"></div>
  `;

  // Troca de aba
  container.querySelectorAll('.status-tab').forEach(t => {
    t.addEventListener('click', () => {
      tab = t.dataset.tab;
      clearFilters();
    });
  });

  function clearFilters() {
    search = typeFilter = sectorFilter = usageFilter = '';
    document.getElementById('search-input').value = '';
    renderChrome();
    renderBody();
  }

  // Busca / filtros
  document.getElementById('search-input').addEventListener('input', e => {
    search = e.target.value;
    onFiltersChanged();
  });
  document.getElementById('adm-type-filter').addEventListener('change', e => {
    typeFilter = e.target.value;
    onFiltersChanged();
  });
  document.getElementById('adm-sector-filter').addEventListener('change', e => {
    sectorFilter = e.target.value;
    onFiltersChanged();
  });
  document.getElementById('adm-usage-filter').addEventListener('change', e => {
    usageFilter = e.target.value;
    onFiltersChanged();
  });
  document.getElementById('adm-clear').addEventListener('click', clearFilters);

  // Ordenação — clicar no critério ativo inverte a direção
  document.getElementById('adm-sort-buttons').addEventListener('click', e => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    const s = sort[tab];
    if (s.key === btn.dataset.sort) s.dir *= -1;
    else { s.key = btn.dataset.sort; s.dir = NUMERIC_SORTS.has(s.key) ? -1 : 1; }  // contagens: maior primeiro
    renderSortButtons();
    renderBody();
  });

  // Criar
  document.getElementById('adm-new').addEventListener('click', () => {
    if (tab === 'types') openActivityTypeForm({ sectors, onDone: refresh });
    else                 openCategoryForm({ sectors, types, presetTypeId: typeFilter, onDone: refresh });
  });

  renderChrome();
  renderBody();
}
