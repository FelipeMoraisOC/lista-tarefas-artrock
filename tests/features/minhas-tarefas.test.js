// Funcionalidade: Minhas Tarefas

import { describe, it, expect } from 'vitest';
import { initTasks } from '../../renderer/js/views/tasks.js';
import { seedWorld, signInAs, makeTask, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, typeInto, choose, waitFor, text, modal } from '../helpers/dom.js';

const me = USERS.dev;
let main;

async function open(tasks) {
  seedWorld({ tasks });
  signInAs(me);
  main = mountAppShell();
  await initTasks(main);
}

const names = () => $$('#tasks-grid .task-card-name', main).map(text);
const tab = status => $(`.status-tab[data-status="${status}"]`, main);
const sortBtn = key => $(`.sort-button[data-sort="${key}"]`, main);

const TASKS = () => [
  makeTask({ name: 'Deploy',   status: 'Em Andamento', priority: 'Baixa', deadline: '2026-10-03', requesterId: USERS.sales.id, categoryId: 'c-feature' }),
  makeTask({ name: 'Bug login', status: 'Para Fazer',  priority: 'Alta',  deadline: '2026-10-05', requesterId: USERS.admin.id, categoryId: 'c-bug' }),
  makeTask({ name: 'Ata',      status: 'Concluído',    priority: 'Média', deadline: '2026-10-01', requesterId: USERS.dev2.id, activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento' }),
  makeTask({ name: 'Delegada', createdById: me.id, responsibleId: USERS.dev2.id }),       // não é minha
];

describe('Minhas Tarefas', () => {
  it('mostra só as tarefas em que sou o responsável', async () => {
    await open(TASKS());
    expect(names().sort()).toEqual(['Ata', 'Bug login', 'Deploy']);
  });

  it('abas mostram a contagem e filtram por status', async () => {
    await open(TASKS());
    expect(text($('#cnt-all', main))).toBe('3');
    expect(text($('#cnt-prog', main))).toBe('1');
    expect(text($('#cnt-todo', main))).toBe('1');
    expect(text($('#cnt-done', main))).toBe('1');

    click(tab('Concluído'));
    expect(names()).toEqual(['Ata']);
    expect(tab('Concluído').classList.contains('active')).toBe(true);
  });

  it('ordena por status por padrão (Para Fazer → Em Andamento → Concluído)', async () => {
    await open(TASKS());
    expect(names()).toEqual(['Bug login', 'Deploy', 'Ata']);
  });

  it('ordena por prioridade, prazo e solicitante', async () => {
    await open(TASKS());
    click(sortBtn('priority'));
    expect(names()).toEqual(['Bug login', 'Ata', 'Deploy']);
    click(sortBtn('deadline'));
    expect(names()).toEqual(['Ata', 'Deploy', 'Bug login']);
    click(sortBtn('requesterId'));
    expect(names()).toEqual(['Ata', 'Deploy', 'Bug login']);   // solicitantes: Bruno, Carla, Diego
  });

  it('numa aba de status, a ordenação "Status" some e passa para prioridade', async () => {
    await open(TASKS());
    click(tab('Para Fazer'));
    expect(sortBtn('status').classList.contains('hidden')).toBe(true);
    expect(sortBtn('priority').classList.contains('active')).toBe(true);
  });

  it('busca por nome, categoria e prioridade', async () => {
    await open(TASKS());
    typeInto($('#search-input', main), 'deploy');
    expect(names()).toEqual(['Deploy']);

    choose($('#filter-col', main), 'categoryId');
    typeInto($('#search-input', main), 'alinhamento');
    expect(names()).toEqual(['Ata']);

    choose($('#filter-col', main), 'priority');
    typeInto($('#search-input', main), 'alta');
    expect(names()).toEqual(['Bug login']);
  });

  it('sem resultados mostra o aviso de lista vazia', async () => {
    await open(TASKS());
    typeInto($('#search-input', main), 'nada disso');
    expect(text($('.empty-title', main))).toBe('Nenhuma tarefa encontrada');
  });

  it('clicar num card abre o detalhe da tarefa', async () => {
    await open(TASKS());
    click($$('#tasks-grid .task-card', main)[0]);
    await waitFor(() => expect(text($('#dd-name-view', modal()))).toBe('Bug login'));
  });

  it('salvar no detalhe atualiza a lista e as contagens', async () => {
    await open(TASKS());
    click($$('#tasks-grid .task-card', main)[0]);            // Bug login (Para Fazer)
    await waitFor(() => expect($('#dd-status')).not.toBeNull());
    choose($('#dd-status'), 'Em Andamento');
    click($('#dd-save'));
    await waitFor(() => expect(text($('#cnt-prog', main))).toBe('2'));
    expect(text($('#cnt-todo', main))).toBe('0');
  });

  it('a legenda dos ícones abre e fecha', async () => {
    await open(TASKS());
    click($('.sort-help-button', main));
    expect($('.sort-help-wrap', main).classList.contains('open')).toBe(true);
    click(document.body);
    expect($('.sort-help-wrap', main).classList.contains('open')).toBe(false);
  });
});
