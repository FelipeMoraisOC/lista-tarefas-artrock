// Funcionalidade: Dashboard

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset } from 'firebase/firestore';
import { initDashboard } from '../../renderer/js/views/dashboard.js';
import { seedWorld, signInAs, makeTask, makeLegacyTask, makeSubtask, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, waitFor, text, modal } from '../helpers/dom.js';

const me = USERS.dev;
let main;

async function open(tasks) {
  __reset();
  seedWorld({ tasks });
  signInAs(me);
  main = mountAppShell();
  await initDashboard(main);
}

const stat = label => {
  const card = $$('.stat-card', main).find(c => text($('.stat-label', c)) === label);
  return { value: text($('.stat-value', card)), sub: text($('.stat-sub', card)) };
};

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z'), toFake: ['Date'] });
});

describe('Dashboard', () => {
  it('conta as minhas tarefas por status e soma as horas investidas', async () => {
    await open([
      makeTask({ status: 'Para Fazer' }),
      makeTask({ status: 'Para Fazer' }),
      makeTask({ status: 'Em Andamento', hoursInvested: 1.5 }),
      makeTask({ status: 'Concluído', hoursInvested: 2.25 }),
    ]);
    expect(stat('Para Fazer').value).toBe('2');
    expect(stat('Em Andamento').value).toBe('1');
    expect(stat('Concluídas').value).toBe('1');
    expect(stat('Concluídas').sub).toBe('3,75h investidas');
  });

  it('considera só tarefas principais em que sou o responsável', async () => {
    const minha = makeTask({ status: 'Para Fazer' });
    await open([
      minha,
      makeSubtask(minha, { status: 'Para Fazer' }),                                   // sub-tarefa
      makeTask({ status: 'Para Fazer', responsibleId: USERS.sales.id }),              // de outra pessoa
      makeTask({ status: 'Para Fazer', responsibleId: null, createdById: me.id }),    // Backlog sem responsável
      makeLegacyTask({ status: 'Para Fazer', createdById: me.id }),                   // antiga: criador = responsável
    ]);
    expect(stat('Para Fazer').value).toBe('2');
  });

  it('lista as tarefas em andamento, ou avisa quando não há nenhuma', async () => {
    await open([makeTask({ name: 'Refatorar API', status: 'Em Andamento' })]);
    expect($$('#dash-inprogress .task-card-name', main).map(text)).toEqual(['Refatorar API']);

    await open([]);
    expect(text($('#dash-inprogress', main))).toBe('Nenhuma tarefa em andamento ⚠️');
  });

  it('próximos prazos: só "Para Fazer", do prazo mais próximo, no máximo 5', async () => {
    await open([
      makeTask({ name: 'P6', deadline: '2026-10-06' }),
      makeTask({ name: 'P1', deadline: '2026-10-01' }),
      makeTask({ name: 'P3', deadline: '2026-10-03' }),
      makeTask({ name: 'P2', deadline: '2026-10-02' }),
      makeTask({ name: 'P5', deadline: '2026-10-05' }),
      makeTask({ name: 'P4', deadline: '2026-10-04' }),
      makeTask({ name: 'Andamento', deadline: '2026-09-27', status: 'Em Andamento' }),
    ]);
    expect($$('#dash-upcoming .task-card-name', main).map(text)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
  });

  it('clicar numa tarefa abre o detalhe dela', async () => {
    await open([makeTask({ name: 'Revisar contrato', status: 'Em Andamento' })]);
    click($('#dash-inprogress .task-card', main));
    await waitFor(() => expect(text($('#dd-name-view'))).toBe('Revisar contrato'));
    expect(modal()).not.toBeNull();
  });
});
