// Card de tarefa (components/task-card.js) — usado no Dashboard, Minhas Tarefas e Delegadas.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskCard, renderTaskCards } from '../../renderer/js/components/task-card.js';
import { makeTask, TYPES, CATEGORIES, USERS } from '../helpers/world.js';
import { $, $$, click, pressKey, text } from '../helpers/dom.js';

const ctx = { categories: CATEGORIES, activityTypes: TYPES, users: Object.values(USERS) };

function renderOne(task, extra = {}) {
  document.body.innerHTML = taskCard(task, { ...ctx, ...extra });
  return $('.task-card');
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z'), toFake: ['Date'] });
});

describe('Card de tarefa', () => {
  it('mostra nome, prioridade, status, % de conclusão, tipo e categoria', () => {
    const card = renderOne(makeTask({
      name: 'Corrigir login', priority: 'Alta', status: 'Em Andamento', completionPercent: 40,
      activityTypeId: 'at-dev', categoryId: 'c-bug',
    }));
    expect(text($('.task-card-name', card))).toBe('Corrigir login');
    expect($('.badge-priority-alta', card)).not.toBeNull();
    expect(text($('.badge-status-em-andamento', card))).toBe('Em Andamento');
    expect(text($('.completion-badge', card))).toBe('40%');
    expect(text(card)).toContain('Desenvolvimento');
    expect(text(card)).toContain('Correção de bug');
  });

  it('prazo vencido destaca o card com ⏰', () => {
    const card = renderOne(makeTask({ deadline: '2026-09-20', status: 'Para Fazer' }));
    expect(card.classList.contains('overdue')).toBe(true);
    expect(text($('.deadline', card))).toBe('⏰ 20/09/2026');
  });

  it('prazo em dia usa 📅 e não destaca', () => {
    const card = renderOne(makeTask({ deadline: '2026-10-20' }));
    expect(card.classList.contains('overdue')).toBe(false);
    expect(text($('.deadline', card))).toBe('📅 20/10/2026');
  });

  it('mostra datas de início e conclusão quando existem', () => {
    const card = renderOne(makeTask({ startDate: '2026-09-01', endDate: '2026-09-10' }));
    expect(text(card)).toContain('🚀 01/09/2026');
    expect(text(card)).toContain('🏁 10/09/2026');
  });

  it('avisa quando há rascunho de descrição não salvo', () => {
    const task = makeTask({ id: 'rascunho' });
    localStorage.setItem('artrock:task-description-draft:rascunho', 'texto');
    expect(text(renderOne(task))).toContain('Descrição da tarefa não está salva');
  });

  it('rodapé mostra o solicitante ou o responsável, conforme a tela', () => {
    const task = makeTask({ requesterId: USERS.sales.id, responsibleId: USERS.dev2.id });
    expect(text($('.task-card-foot', renderOne(task)))).toBe('👤 Carla Vendas');
    expect(text($('.task-card-foot', renderOne(task, { person: 'responsible' })))).toBe('👤 Bruno TI');
  });

  it('escapa HTML no nome (não executa código injetado)', () => {
    const card = renderOne(makeTask({ name: '<img src=x onerror=alert(1)>' }));
    expect($('img', card)).toBeNull();
    expect(text($('.task-card-name', card))).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('Lista de cards (renderTaskCards)', () => {
  it('lista vazia mostra a mensagem de vazio', () => {
    const grid = document.createElement('div');
    renderTaskCards(grid, [], { ...ctx, emptyHtml: '<p class="vazio">Nada aqui</p>' });
    expect(text(grid)).toBe('Nada aqui');
  });

  it('clique e Enter abrem a tarefa pelo id', () => {
    const grid = document.createElement('div');
    document.body.appendChild(grid);
    const onOpen = vi.fn();
    renderTaskCards(grid, [makeTask({ id: 'a' }), makeTask({ id: 'b' })], { ...ctx, onOpen });

    click($$('.task-card', grid)[0]);
    pressKey($$('.task-card', grid)[1], 'Enter');

    expect(onOpen.mock.calls).toEqual([['a'], ['b']]);
  });
});
