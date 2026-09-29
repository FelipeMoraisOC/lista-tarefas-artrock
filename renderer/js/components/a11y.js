// ── Acessibilidade: foco em diálogos e estado de botões ──

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Visível na tela? (no jsdom, sem layout, olha `hidden` e `display: none` dos ancestrais)
export function isVisible(el) {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility();
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden || getComputedStyle(n).display === 'none') return false;
  }
  return true;
}

export function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(isVisible);
}

// Tab e Shift+Tab circulam dentro de `root` (diálogos).
export function trapTab(e, root) {
  if (e.key !== 'Tab') return;
  const list = focusables(root);
  if (!list.length) { e.preventDefault(); root.focus(); return; }

  const first  = list[0];
  const last   = list.at(-1);
  const active = document.activeElement;
  const outside = !root.contains(active);

  if (e.shiftKey && (active === first || active === root || outside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || outside)) {
    e.preventDefault();
    first.focus();
  }
}

// Botões de alternância (abas, ordenação, filtros): classe .active + aria-pressed.
export function setPressed(el, on) {
  el.classList.toggle('active', on);
  el.setAttribute('aria-pressed', String(on));
}

// Refaz uma lista (innerHTML) sem perder o foco: depois de `render()`, volta
// para o elemento de mesmo `id` ou, sem id, para o item de mesmo `data-<key>`.
export function keepFocus(container, render, key = 'id') {
  const active = document.activeElement;
  let selector = null;
  if (container && active && active !== container && container.contains(active)) {
    const attr = `data-${key}`;
    const item = active.closest(`[${attr}]`);
    if (active.id) selector = `[id="${quote(active.id)}"]`;
    else if (item) selector = `[${attr}="${quote(item.getAttribute(attr))}"]`;
  }
  render();
  if (!selector) return;
  const again = container.querySelector(selector);
  if (again && again !== document.activeElement) again.focus();
}

const quote = s => String(s).replace(/["\\]/g, '\\$&');
