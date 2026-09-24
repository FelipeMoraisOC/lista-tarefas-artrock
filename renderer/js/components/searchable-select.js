// ── Searchable Select (dropdown com filtro) ──────────────

let _activeDropdown = null;

function closeActiveDropdown() {
  if (!_activeDropdown) return;
  _activeDropdown.wrapper.classList.remove('ss-open');
  _activeDropdown = null;
}

document.addEventListener('click', e => {
  if (_activeDropdown && !_activeDropdown.wrapper.contains(e.target)) closeActiveDropdown();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _activeDropdown) closeActiveDropdown();
});

export function createSearchableSelect({
  options,
  value = '',
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado',
  onChange,
  renderOption,
  id,
  className = '',
}) {
  const wrapper = document.createElement('div');
  wrapper.className = `ss-wrapper ${className}`.trim();
  if (id) wrapper.id = id;

  let selected = value;
  let filteredOpts = [...options];

  function selectedLabel() {
    const opt = options.find(o => o.value === selected);
    return opt ? opt.label : '';
  }

  wrapper.innerHTML = `
    <button type="button" class="ss-trigger" title="${placeholder}">
      <span class="ss-trigger-text">${selected ? esc(selectedLabel()) : `<span class="ss-placeholder">${esc(placeholder)}</span>`}</span>
      <svg class="ss-arrow" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 10l5 5 5-5z"/></svg>
    </button>
    <div class="ss-dropdown">
      <div class="ss-search-wrap">
        <svg class="ss-search-icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input type="text" class="ss-search" placeholder="${esc(searchPlaceholder)}" autocomplete="off" />
      </div>
      <div class="ss-options"></div>
    </div>
  `;

  const trigger = wrapper.querySelector('.ss-trigger');
  const triggerText = wrapper.querySelector('.ss-trigger-text');
  const dropdown = wrapper.querySelector('.ss-dropdown');
  const searchInput = wrapper.querySelector('.ss-search');
  const optionsContainer = wrapper.querySelector('.ss-options');

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function renderOptions() {
    if (!filteredOpts.length) {
      optionsContainer.innerHTML = `<div class="ss-empty">${esc(emptyText)}</div>`;
      return;
    }
    optionsContainer.innerHTML = filteredOpts.map(opt => {
      const isSelected = opt.value === selected;
      const content = renderOption ? renderOption(opt) : esc(opt.label);
      return `<div class="ss-option${isSelected ? ' ss-selected' : ''}" data-value="${esc(opt.value)}">${content}</div>`;
    }).join('');
  }

  function open() {
    if (_activeDropdown && _activeDropdown.wrapper !== wrapper) closeActiveDropdown();
    wrapper.classList.add('ss-open');
    _activeDropdown = { wrapper };
    searchInput.value = '';
    filteredOpts = [...options];
    renderOptions();
    requestAnimationFrame(() => searchInput.focus());
  }

  function close() {
    wrapper.classList.remove('ss-open');
    if (_activeDropdown?.wrapper === wrapper) _activeDropdown = null;
  }

  function select(val) {
    selected = val;
    const opt = options.find(o => o.value === selected);
    triggerText.innerHTML = opt
      ? esc(opt.label)
      : `<span class="ss-placeholder">${esc(placeholder)}</span>`;
    close();
    if (onChange) onChange(val, opt);
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    wrapper.classList.contains('ss-open') ? close() : open();
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase().trim();
    filteredOpts = term
      ? options.filter(o => o.label.toLowerCase().includes(term))
      : [...options];
    renderOptions();
  });

  searchInput.addEventListener('click', e => e.stopPropagation());

  optionsContainer.addEventListener('click', e => {
    const optEl = e.target.closest('.ss-option');
    if (!optEl) return;
    select(optEl.dataset.value);
  });

  renderOptions();

  wrapper.getValue = () => selected;
  wrapper.setValue = (val) => {
    selected = val;
    const opt = options.find(o => o.value === selected);
    triggerText.innerHTML = opt
      ? esc(opt.label)
      : `<span class="ss-placeholder">${esc(placeholder)}</span>`;
  };
  wrapper.setOptions = (newOpts) => {
    options = newOpts;
    filteredOpts = [...options];
    renderOptions();
    const opt = options.find(o => o.value === selected);
    triggerText.innerHTML = opt
      ? esc(opt.label)
      : `<span class="ss-placeholder">${esc(placeholder)}</span>`;
  };

  return wrapper;
}
