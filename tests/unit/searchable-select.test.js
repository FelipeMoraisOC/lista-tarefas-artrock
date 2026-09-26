// Seletor com busca (components/searchable-select.js) — escolha de responsável.

import { describe, it, expect, vi } from 'vitest';
import { createSearchableSelect } from '../../renderer/js/components/searchable-select.js';
import { $, $$, click, typeInto, pressKey, text } from '../helpers/dom.js';

const OPTIONS = [
  { value: 'u1', label: 'Ana Dev' },
  { value: 'u2', label: 'Bruno TI' },
  { value: 'u3', label: 'Carla Vendas' },
];

function mount(props = {}) {
  const el = createSearchableSelect({ options: OPTIONS, placeholder: 'Escolher...', ...props });
  document.body.appendChild(el);
  return el;
}

const openList = el => click($('.ss-trigger', el));
const labels = el => $$('.ss-option', el).map(text);

describe('Seletor com busca', () => {
  it('mostra o placeholder sem valor e o nome quando há valor', () => {
    expect(text($('.ss-trigger-text', mount()))).toBe('Escolher...');
    expect(text($('.ss-trigger-text', mount({ value: 'u2' })))).toBe('Bruno TI');
  });

  it('abrir lista as opções; digitar filtra (sem diferenciar maiúsculas)', () => {
    const el = mount();
    openList(el);
    expect(el.classList.contains('ss-open')).toBe(true);
    expect(labels(el)).toEqual(['Ana Dev', 'Bruno TI', 'Carla Vendas']);

    typeInto($('.ss-search', el), 'VEN');
    expect(labels(el)).toEqual(['Carla Vendas']);

    typeInto($('.ss-search', el), 'zzz');
    expect(text($('.ss-empty', el))).toBe('Nenhum resultado');
  });

  it('escolher uma opção atualiza o texto, fecha e avisa o valor', () => {
    const onChange = vi.fn();
    const el = mount({ onChange });
    openList(el);
    click($$('.ss-option', el)[2]);

    expect(onChange).toHaveBeenCalledWith('u3', OPTIONS[2]);
    expect(text($('.ss-trigger-text', el))).toBe('Carla Vendas');
    expect(el.classList.contains('ss-open')).toBe(false);
    expect(el.getValue()).toBe('u3');
  });

  it('fecha ao clicar fora ou apertar Esc, e só um fica aberto por vez', () => {
    const a = mount();
    const b = mount();
    openList(a);
    openList(b);
    expect(a.classList.contains('ss-open')).toBe(false);
    expect(b.classList.contains('ss-open')).toBe(true);

    click(document.body);
    expect(b.classList.contains('ss-open')).toBe(false);

    openList(a);
    pressKey(document, 'Escape');
    expect(a.classList.contains('ss-open')).toBe(false);
  });

  it('setValue e setOptions atualizam sem disparar onChange', () => {
    const onChange = vi.fn();
    const el = mount({ onChange });
    el.setValue('u1');
    expect(text($('.ss-trigger-text', el))).toBe('Ana Dev');

    el.setOptions([{ value: 'u9', label: 'Novo' }]);
    expect(text($('.ss-trigger-text', el))).toBe('Escolher...');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('escapa HTML dos nomes', () => {
    const el = mount({ options: [{ value: 'x', label: '<b>negrito</b>' }], value: 'x' });
    expect($('b', el)).toBeNull();
    expect(text($('.ss-trigger-text', el))).toBe('<b>negrito</b>');
  });
});
