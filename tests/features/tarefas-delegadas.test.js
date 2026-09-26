// Funcionalidade: Tarefas Delegadas

import { describe, it, expect } from 'vitest';
import { initDelegated } from '../../renderer/js/views/delegated.js';
import { seedWorld, signInAs, makeTask, makeSubtask, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, choose, settle, waitFor, text } from '../helpers/dom.js';

const me = USERS.dev;
let main;

async function open(tasks) {
  seedWorld({ tasks });
  signInAs(me);
  main = mountAppShell();
  await initDelegated(main);
  await settle(1);   // o painel de filtros liga os botões num setTimeout
}

const names = () => $$('#deleg-grid .task-card-name', main).map(text);

describe('Tarefas Delegadas', () => {
  it('lista o que criei e atribuí a outra pessoa — e nada mais', async () => {
    const delegada = makeTask({ name: 'Delegada', createdById: me.id, responsibleId: USERS.sales.id });
    await open([
      delegada,
      makeTask({ name: 'Minha', createdById: me.id, responsibleId: me.id }),
      makeTask({ name: 'Sem responsável', createdById: me.id, responsibleId: null }),
      makeTask({ name: 'De outra pessoa', createdById: USERS.sales.id, responsibleId: USERS.dev2.id }),
      makeSubtask(delegada, { name: 'Sub', createdById: me.id, responsibleId: USERS.sales.id }),
    ]);
    expect(names()).toEqual(['Delegada']);
    expect(text($('#deleg-count', main))).toBe('1');
  });

  it('o card mostra o responsável (para quem delegei)', async () => {
    await open([makeTask({ createdById: me.id, responsibleId: USERS.sales.id })]);
    expect(text($('.task-card-foot', main))).toBe('👤 Carla Vendas');
  });

  it('ordena por prazo e inverte a direção', async () => {
    await open([
      makeTask({ name: 'Outubro', createdById: me.id, responsibleId: USERS.sales.id, deadline: '2026-10-10' }),
      makeTask({ name: 'Setembro', createdById: me.id, responsibleId: USERS.sales.id, deadline: '2026-09-30' }),
    ]);
    expect(names()).toEqual(['Setembro', 'Outubro']);
    click($('#deleg-dir', main));
    expect(names()).toEqual(['Outubro', 'Setembro']);
    expect(text($('#deleg-dir-label', main))).toBe('Decrescente');
  });

  it('o painel de filtros reduz a lista', async () => {
    await open([
      makeTask({ name: 'Andando', status: 'Em Andamento', createdById: me.id, responsibleId: USERS.sales.id }),
      makeTask({ name: 'Parada', status: 'Para Fazer', createdById: me.id, responsibleId: USERS.sales.id }),
    ]);
    choose($('#tf-status', main), 'Em Andamento');
    click($('#tf-apply', main));
    expect(names()).toEqual(['Andando']);
    expect(text($('#deleg-count', main))).toBe('1');
  });

  it('sem tarefas delegadas mostra o aviso', async () => {
    await open([]);
    expect(text($('.empty-title', main))).toBe('Nenhuma tarefa encontrada');
  });

  it('ordena pela data de conclusão e de início (sem data vai para o fim)', async () => {
    await open([
      makeTask({ name: 'Sem datas', createdById: me.id, responsibleId: USERS.sales.id }),
      makeTask({ name: 'Concluiu dia 20', createdById: me.id, responsibleId: USERS.sales.id, startDate: '2026-09-15', endDate: '2026-09-20' }),
      makeTask({ name: 'Concluiu dia 10', createdById: me.id, responsibleId: USERS.sales.id, startDate: '2026-09-18', endDate: '2026-09-10' }),
    ]);
    click($('.deleg-sort [data-sort="end"]', main));
    expect(names()).toEqual(['Concluiu dia 10', 'Concluiu dia 20', 'Sem datas']);
    click($('.deleg-sort [data-sort="start"]', main));
    expect(names()).toEqual(['Concluiu dia 20', 'Concluiu dia 10', 'Sem datas']);
  });

  it('abrir e salvar uma tarefa atualiza a lista (ex.: trouxe a tarefa de volta para mim)', async () => {
    await open([makeTask({ name: 'Voltar pra mim', createdById: me.id, responsibleId: USERS.sales.id })]);
    click($('#deleg-grid .task-card', main));
    await waitFor(() => expect($('#dd-resp-container .ss-trigger')).not.toBeNull());
    click($('#dd-resp-container .ss-trigger'));
    click($(`#dd-resp-container .ss-option[data-value="${me.id}"]`));
    click($('#dd-save'));
    await waitFor(() => expect(names()).toEqual([]));
  });

  it('a legenda dos ícones abre no "?" e fecha ao clicar fora', async () => {
    await open([]);
    const wrap = $('.sort-help-wrap', main);
    click($('.sort-help-button', main));
    expect(wrap.classList.contains('open')).toBe(true);
    expect($('.sort-help-button', main).getAttribute('aria-expanded')).toBe('true');
    click(document.body);
    expect(wrap.classList.contains('open')).toBe(false);
  });
});
