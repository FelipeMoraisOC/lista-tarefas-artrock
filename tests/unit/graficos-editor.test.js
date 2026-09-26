// Gráficos (chart.js), Markdown (markdown.js) e editor (editor.js).
// As bibliotecas vêm de CDN no app; aqui usamos versões falsas no `window`.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderPie, renderBar } from '../../renderer/js/components/chart.js';
import { renderMd } from '../../renderer/js/components/markdown.js';
import { initEditor, destroyAllEditors, destroyEditor } from '../../renderer/js/components/editor.js';
import { makeTask, CATEGORIES } from '../helpers/world.js';

class FakeChart {
  static instances = [];
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.destroyed = false;
    FakeChart.instances.push(this);
  }
  destroy() { this.destroyed = true; }
}

afterEach(() => {
  delete window.Chart;
  delete window.marked;
  delete window.EasyMDE;
  FakeChart.instances = [];
});

const canvas = () => document.createElement('canvas');

describe('Gráfico de pizza — horas por categoria', () => {
  const tasks = [
    makeTask({ categoryId: 'c-bug', hoursInvested: 2, responsibleId: 'u-dev' }),
    makeTask({ categoryId: 'c-bug', hoursInvested: 1.5, responsibleId: 'u-dev' }),
    makeTask({ categoryId: 'c-feature', hoursInvested: 3, responsibleId: 'u-dev' }),
    makeTask({ categoryId: 'c-feature', hoursInvested: 10, responsibleId: 'u-sales' }),  // de outra pessoa
  ];

  it('sem a biblioteca Chart.js carregada, não faz nada (e não quebra)', () => {
    expect(() => renderPie(canvas(), tasks, CATEGORIES, 'u-dev')).not.toThrow();
  });

  it('soma só as horas do usuário, por categoria', () => {
    window.Chart = FakeChart;
    renderPie(canvas(), tasks, CATEGORIES, 'u-dev');
    const { labels, datasets } = FakeChart.instances[0].config.data;
    expect(labels).toEqual(['Correção de bug', 'Nova funcionalidade']);
    expect(datasets[0].data).toEqual([3.5, 3]);
  });

  it('sem horas registradas mostra "Sem dados"', () => {
    window.Chart = FakeChart;
    renderPie(canvas(), [], CATEGORIES, 'u-dev');
    expect(FakeChart.instances[0].config.data.labels).toEqual(['Sem dados']);
  });

  it('tooltip mostra as horas formatadas; redesenhar destrói o gráfico anterior', () => {
    window.Chart = FakeChart;
    const c = canvas();
    renderPie(c, tasks, CATEGORIES, 'u-dev');
    const label = FakeChart.instances[0].config.options.plugins.tooltip.callbacks.label;
    expect(label({ label: 'Correção de bug', raw: 1.3333 })).toBe(' Correção de bug: 1,33h');

    renderPie(c, tasks, CATEGORIES, 'u-dev');
    expect(FakeChart.instances[0].destroyed).toBe(true);
  });
});

describe('Gráfico de barras — horas por dia (14 dias)', () => {
  it('soma as horas no dia da conclusão, por categoria', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 12), toFake: ['Date'] });
    window.Chart = FakeChart;
    renderBar(canvas(), [
      makeTask({ categoryId: 'c-bug', hoursInvested: 2, endDate: '2026-09-26', responsibleId: 'u-dev' }),
      makeTask({ categoryId: 'c-bug', hoursInvested: 1, endDate: '2026-09-26', responsibleId: 'u-dev' }),
      makeTask({ categoryId: 'c-bug', hoursInvested: 4, endDate: '2026-09-20', responsibleId: 'u-dev' }),
    ], CATEGORIES, 'u-dev');

    const { labels, datasets } = FakeChart.instances[0].config.data;
    expect(labels).toHaveLength(14);
    expect(labels.at(-1)).toBe('26/09');
    expect(datasets).toHaveLength(1);
    expect(datasets[0].data.at(-1)).toBe(3);
    expect(datasets[0].data.at(-7)).toBe(4);
  });
});

describe('Gráfico de barras — sem dados e rótulos', () => {
  it('sem horas mostra "Sem dados"; eixo e tooltip mostram horas', () => {
    window.Chart = FakeChart;
    renderBar(canvas(), [], CATEGORIES, 'u-dev');
    const { data, options } = FakeChart.instances[0].config;
    expect(data.datasets[0].label).toBe('Sem dados');
    expect(options.scales.y.ticks.callback(3)).toBe('3h');
    expect(options.plugins.tooltip.callbacks.label({ dataset: { label: 'Bug' }, raw: 2.5 })).toBe(' Bug: 2,5h');
  });
});

describe('Markdown', () => {
  it('texto vazio vira string vazia', () => {
    expect(renderMd('')).toBe('');
    expect(renderMd(null)).toBe('');
  });

  it('sem a biblioteca marked, devolve o texto como está', () => {
    expect(renderMd('**oi**')).toBe('**oi**');
  });

  it('com marked, converte; se a conversão falhar, devolve o texto', () => {
    window.marked = { parse: t => `<p>${t}</p>` };
    expect(renderMd('oi')).toBe('<p>oi</p>');
    window.marked = { parse: () => { throw new Error('boom'); } };
    expect(renderMd('oi')).toBe('oi');
  });
});

describe('Editor de descrição (EasyMDE)', () => {
  it('sem a biblioteca carregada, não cria editor (o app usa o textarea simples)', () => {
    expect(initEditor(document.createElement('textarea'))).toBeNull();
  });

  it('cria o editor com as opções do app e destrói todos ao fechar o modal', () => {
    const toTextArea = vi.fn();
    window.EasyMDE = vi.fn(function (opts) { this.opts = opts; this.toTextArea = toTextArea; });
    const ed = initEditor(document.createElement('textarea'), { placeholder: 'Descreva...', minHeight: 120 });
    initEditor(document.createElement('textarea'));

    expect(ed.opts).toMatchObject({ placeholder: 'Descreva...', minHeight: '120px', spellChecker: false });
    destroyAllEditors();
    expect(toTextArea).toHaveBeenCalledTimes(2);
  });

  it('a pré-visualização usa o Markdown quando disponível; destroyEditor fecha só um', () => {
    const toTextArea = vi.fn();
    window.EasyMDE = vi.fn(function (opts) { this.opts = opts; this.toTextArea = toTextArea; });
    const ed = initEditor(document.createElement('textarea'));
    expect(ed.opts.previewRender('**x**')).toBe('**x**');
    window.marked = { parse: t => `<b>${t}</b>` };
    expect(ed.opts.previewRender('x')).toBe('<b>x</b>');

    destroyEditor(ed);
    destroyEditor(null);
    expect(toTextArea).toHaveBeenCalledOnce();
  });
});
