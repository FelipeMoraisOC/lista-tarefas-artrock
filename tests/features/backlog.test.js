// Funcionalidade: Backlog — tarefas de todos os setores.

import { describe, it, expect } from 'vitest';
import { initBacklog } from '../../renderer/js/views/backlog.js';
import { seedWorld, signInAs, makeTask, makeLegacyTask, makeSubtask, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, typeInto, choose, waitFor, text, modal } from '../helpers/dom.js';

const bug = makeTask({ id: 'bug', name: 'Bug no login', sectorId: 's1', activityTypeId: 'at-dev', categoryId: 'c-bug', responsibleId: USERS.dev.id, createdById: USERS.dev.id, status: 'Em Andamento' });
const daily = makeTask({ id: 'daily', name: 'Daily', sectorId: 's1', activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento', responsibleId: null, createdById: USERS.dev2.id });
const acme = makeLegacyTask({ id: 'acme', name: 'Visita ACME', activityTypeId: 'at-venda', categoryId: 'c-cliente', createdById: USERS.sales.id });
const okr = makeTask({ id: 'okr', name: 'OKR Q4', sectorId: 's5', activityTypeId: 'at-gestao', categoryId: 'c-okr', responsibleId: USERS.manager.id, createdById: USERS.manager.id });
const pedido = makeTask({ id: 'pedido', name: 'Pedido ao admin', sectorId: 's4', activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento', responsibleId: USERS.admin.id, createdById: USERS.dev.id });
const auditoria = makeTask({ id: 'auditoria', name: 'Auditoria interna', sectorId: 's4', activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento', responsibleId: USERS.admin.id, createdById: USERS.admin.id });
const orfa = makeTask({ id: 'orfa', name: 'Sem dono', responsibleId: null, createdById: 'usuario-removido' });
const subBug = makeSubtask(bug, { id: 'sub-bug', name: 'Escrever teste do bug' });

let main;

async function openAs(user, tasks = [bug, daily, acme, okr, pedido, auditoria, orfa, subBug]) {
  seedWorld({ tasks });
  signInAs(user);
  main = mountAppShell();
  await initBacklog(main);
}

const sectorCards = () => $$('#bl-sectors .bl-card', main).map(c => [text($('.bl-card-name', c)), text($('.badge', c))]);
const typeCards = () => $$('#bl-types .bl-card', main).map(c => [text($('.bl-card-name', c)), text($('.bl-card-count', c))]);
const rows = () => $$('#bl-table-body tr[data-id]', main).map(r => text($('.bl-task-name', r)));
const selectSector = name => click($$('#bl-sectors .bl-card', main).find(c => text($('.bl-card-name', c)) === name));
const selectType = name => click($$('#bl-types .bl-card', main).find(c => text($('.bl-card-name', c)) === name));

describe('Backlog — setores e visibilidade', () => {
  it('lista os setores (sem "TODOS") com a contagem de tarefas', async () => {
    await openAs(USERS.dev);
    expect(sectorCards()).toEqual([
      ['T.I', '2'], ['Backoffice Digital', '0'], ['Vendas', '1'], ['Admin', '1'], ['Sem setor', '1'],
    ]);
  });

  it('quem não é Admin/Gestão não vê Gestão; em Admin vê só o que criou', async () => {
    await openAs(USERS.dev);
    expect(sectorCards().map(([name]) => name)).not.toContain('Gestão');
    selectSector('Admin');
    selectType('Todos os tipos');
    expect(rows()).toEqual(['Pedido ao admin']);
  });

  it('Admin e Gestão veem todos os setores e todas as tarefas', async () => {
    await openAs(USERS.manager);
    expect(sectorCards()).toEqual(expect.arrayContaining([['Admin', '2'], ['Gestão', '1']]));
  });

  it('abre no primeiro setor do usuário', async () => {
    await openAs(USERS.sales);
    expect(text($('#bl-types-title', main))).toBe('Tipos de atividade — Vendas');
    expect($('#bl-sectors .bl-card.active', main).dataset.sector).toBe('s3');
  });

  it('tarefa antiga (sem setor gravado) entra no setor do responsável', async () => {
    await openAs(USERS.dev);
    selectSector('Vendas');
    selectType('Todos os tipos');
    expect(rows()).toEqual(['Visita ACME']);
  });
});

describe('Backlog — tipos de atividade e tabela', () => {
  it('mostra os tipos do setor com a contagem, mais "Todos os tipos"', async () => {
    await openAs(USERS.dev);
    expect(typeCards()).toEqual([
      ['Todos os tipos', '2 tarefas'],
      ['Desenvolvimento', '1 tarefa'],
      ['Reunião', '1 tarefa'],
    ]);
  });

  it('clicar num tipo mostra a tabela só com as tarefas dele', async () => {
    await openAs(USERS.dev);
    expect($('#bl-table-section', main).classList.contains('hidden')).toBe(true);
    selectType('Desenvolvimento');
    expect($('#bl-table-section', main).classList.contains('hidden')).toBe(false);
    expect(rows()).toEqual(['Bug no login']);

    const row = $('#bl-table-body tr[data-id="bug"]', main);
    expect(text(row)).toContain('Ana Dev');
    expect(text(row)).toContain('Correção de bug');
    expect(text(row)).toContain('Em Andamento');
  });

  it('tarefa sem responsável aparece como "Sem responsável" e tem filtro próprio', async () => {
    await openAs(USERS.dev);
    selectType('Todos os tipos');
    expect(text($('#bl-table-body tr[data-id="daily"]', main))).toContain('Sem responsável');

    click($('#bl-no-resp', main));
    expect(rows()).toEqual(['Daily']);
  });

  it('busca e filtro de status', async () => {
    await openAs(USERS.dev);
    selectType('Todos os tipos');
    typeInto($('#bl-search', main), 'login');
    expect(rows()).toEqual(['Bug no login']);
    typeInto($('#bl-search', main), '');
    choose($('#bl-status', main), 'Para Fazer');
    expect(rows()).toEqual(['Daily']);
    expect(text($('#bl-count', main))).toBe('1');
  });

  it('a seta expande as sub-tarefas na própria tabela', async () => {
    await openAs(USERS.dev);
    selectType('Desenvolvimento');
    expect($('.bl-sub-count', main).textContent).toBe('1');
    click($('[data-expand="bug"]', main));
    expect(rows()).toEqual(['Bug no login', 'Escrever teste do bug']);
  });

  it('"Sem setor" agrupa tarefas cujo setor não dá para descobrir', async () => {
    await openAs(USERS.dev);
    selectSector('Sem setor');
    selectType('Todos os tipos');
    expect(rows()).toEqual(['Sem dono']);
  });
});

describe('Backlog — abrir e criar tarefas', () => {
  it('clicar numa linha abre o detalhe (só visualização para quem não é dono)', async () => {
    await openAs(USERS.dev);
    selectSector('Vendas');
    selectType('Todos os tipos');
    click($('#bl-table-body tr[data-id="acme"]', main));
    await waitFor(() => expect(text($('#dd-name-view'))).toBe('Visita ACME'));
    expect(modal().classList.contains('tc-readonly')).toBe(true);
  });

  it('Enter numa linha também abre o detalhe', async () => {
    await openAs(USERS.dev);
    selectType('Desenvolvimento');
    $('#bl-table-body tr[data-id="bug"]', main)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => expect(text($('#dd-name-view'))).toBe('Bug no login'));
  });

  it('"Nova Tarefa" abre a criação do Backlog com setor e tipo já escolhidos', async () => {
    await openAs(USERS.dev);
    selectSector('Vendas');
    selectType('Prospecção');
    click($('#bl-new', main));
    await waitFor(() => expect($('#fc-sector')).not.toBeNull());
    expect($('#fc-sector').value).toBe('s3');
    expect($('#fc-at').value).toBe('at-venda');
  });
});
