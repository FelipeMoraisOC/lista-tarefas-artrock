// Painel de filtros (components/task-filter.js) — usado em Tarefas Delegadas.

import { describe, it, expect, vi } from 'vitest';
import { applyFilters, createTaskFilter } from '../../renderer/js/components/task-filter.js';
import { makeTask, TYPES, CATEGORIES, USERS } from '../helpers/world.js';
import { $, click, choose, optionValues, settle } from '../helpers/dom.js';

const tasks = [
  makeTask({ id: 'a', status: 'Para Fazer',   priority: 'Alta',  requesterId: 'u-sales', activityTypeId: 'at-dev',     categoryId: 'c-bug',         deadline: '2026-10-01', startDate: '2026-09-01', endDate: null }),
  makeTask({ id: 'b', status: 'Em Andamento', priority: 'Média', requesterId: 'u-dev2',  activityTypeId: 'at-dev',     categoryId: 'c-feature',     deadline: '2026-10-15', startDate: '2026-09-10', endDate: null }),
  makeTask({ id: 'c', status: 'Concluído',    priority: 'Baixa', requesterId: 'u-sales', activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento', deadline: '2026-09-20', startDate: '2026-09-05', endDate: '2026-09-18' }),
];
const ids = list => list.map(t => t.id);

describe('applyFilters', () => {
  it('sem filtros devolve tudo', () => {
    expect(ids(applyFilters(tasks, {}))).toEqual(['a', 'b', 'c']);
  });

  it.each([
    [{ status: 'Em Andamento' }, ['b']],
    [{ priority: 'Baixa' }, ['c']],
    [{ requesterId: 'u-sales' }, ['a', 'c']],
    [{ activityTypeId: 'at-dev' }, ['a', 'b']],
    [{ activityTypeId: 'at-dev', categoryId: 'c-feature' }, ['b']],
    [{ requesterId: 'u-sales', status: 'Concluído' }, ['c']],
  ])('filtra por campo: %o', (filters, expected) => {
    expect(ids(applyFilters(tasks, filters))).toEqual(expected);
  });

  it('intervalos de data incluem as pontas (prazo, início e conclusão)', () => {
    expect(ids(applyFilters(tasks, { deadlineFrom: '2026-10-01', deadlineTo: '2026-10-15' }))).toEqual(['a', 'b']);
    expect(ids(applyFilters(tasks, { startFrom: '2026-09-05' }))).toEqual(['b', 'c']);
    expect(ids(applyFilters(tasks, { startTo: '2026-09-05' }))).toEqual(['a', 'c']);
  });

  it('tarefa sem a data fica de fora quando há filtro de "a partir de"', () => {
    expect(ids(applyFilters(tasks, { endFrom: '2026-09-01' }))).toEqual(['c']);
  });
});

describe('Painel de filtros', () => {
  function mount(onChange = vi.fn()) {
    const panel = createTaskFilter({ tasks, users: Object.values(USERS), activityTypes: TYPES, categories: CATEGORIES, onChange });
    document.body.appendChild(panel);
    return { panel, onChange };
  }

  it('solicitantes e tipos listam só o que aparece nas tarefas', () => {
    const { panel } = mount();
    expect(optionValues($('#tf-requester', panel))).toEqual(['', 'u-dev2', 'u-sales']);
    expect(optionValues($('#tf-activityType', panel))).toEqual(['', 'at-dev', 'at-reuniao']);
  });

  it('categoria fica bloqueada até escolher o tipo e lista só categorias usadas', async () => {
    const { panel } = mount();
    await settle(1);
    expect($('#tf-category', panel).disabled).toBe(true);

    choose($('#tf-activityType', panel), 'at-dev');

    expect($('#tf-category', panel).disabled).toBe(false);
    expect(optionValues($('#tf-category', panel))).toEqual(['', 'c-bug', 'c-feature']);
  });

  it('"Aplicar" envia os filtros escolhidos', async () => {
    const { panel, onChange } = mount();
    await settle(1);
    choose($('#tf-status', panel), 'Concluído');
    $('#tf-deadline-from', panel).value = '2026-09-01';

    click($('#tf-apply', panel));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'Concluído', deadlineFrom: '2026-09-01', priority: '' }));
  });

  it('"Limpar" zera tudo e avisa com filtros vazios', async () => {
    const { panel, onChange } = mount();
    await settle(1);
    choose($('#tf-priority', panel), 'Alta');
    choose($('#tf-activityType', panel), 'at-dev');

    click($('#tf-clear', panel));

    const filters = onChange.mock.calls.at(-1)[0];
    expect(Object.values(filters).every(v => v === '')).toBe(true);
    expect($('#tf-category', panel).disabled).toBe(true);
  });

  it('seções de data abrem e fecham', () => {
    const { panel } = mount();
    const body = $('#tf-body-deadline', panel);
    expect(body.classList.contains('tf-collapsed')).toBe(true);
    click($('[data-toggle="deadline"]', panel));
    expect(body.classList.contains('tf-collapsed')).toBe(false);
  });
});
