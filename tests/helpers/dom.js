// ── Utilidades de DOM para os testes ──────────────────────

import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Corpo real do renderer/index.html (sem scripts e CDNs): os testes usam
// a mesma marcação do app — menu, modal, toasts, painel do timer…
// (caminho a partir de string: no jsdom, a classe URL global não é a do Node)
const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, '..', '..', 'renderer', 'index.html'), 'utf8');
const appBody = indexHtml
  .match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<link[^>]*>/gi, '');

export function mountAppShell() {
  document.body.innerHTML = appBody;
  return document.getElementById('main-content');
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Deixa as Promises e timers pendentes rodarem (use com timers reais).
export async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i++) await new Promise(r => setTimeout(r, 0));
}

// Espera uma condição ficar verdadeira. Use quando a tela carrega algo sob
// demanda (ex.: o modal de detalhe é importado na hora do clique) — contar
// "voltas" fixas quebra em máquinas lentas ou com a cobertura ligada.
export const waitFor = (assertion, timeout = 4000) => vi.waitFor(assertion, { timeout, interval: 10 });

export function click(el) {
  if (!el) throw new Error('click(): elemento não encontrado');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function typeInto(input, value) {
  if (!input) throw new Error('typeInto(): campo não encontrado');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function choose(select, value) {
  if (!select) throw new Error('choose(): campo não encontrado');
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function check(checkbox, checked = true) {
  checkbox.checked = checked;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

export function pressKey(el, key, extra = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
}

// Nome acessível simplificado (o que um leitor de tela anunciaria):
// aria-labelledby > aria-label > <label for> / <label> em volta.
export function accessibleName(el) {
  if (!el) return '';
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(/\s+/).map(id => text(document.getElementById(id))).join(' ').trim();
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  if (el.labels?.length) return text(el.labels[0]);
  return '';
}

// Campos de formulário sem nome acessível dentro de `root` (ids/classes para a mensagem de erro).
export const unnamedControls = root =>
  $$('input:not([type="hidden"]), select, textarea', root)
    .filter(el => !accessibleName(el))
    .map(el => el.id ? `#${el.id}` : `.${el.className}`);

export const toastTexts = () =>$$('#toast-container .toast').map(t => t.textContent.replace(/\s+/g, ' ').trim());
export const lastToast  = () => toastTexts().at(-1) ?? '';
export const modal      = () => document.getElementById('_modal');
export const text       = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
export const optionValues = select => [...select.options].map(o => o.value);
export const optionLabels = select => [...select.options].map(o => o.textContent.trim());
