// Funcionalidade: Administração — Tipos de Atividade e Categorias.

import { describe, it, expect, beforeEach } from 'vitest';
import { __doc, __all } from 'firebase/firestore';
import { initAdmin } from '../../renderer/js/views/admin.js';
import { seedWorld, signInAs, makeTask, USERS } from '../helpers/world.js';
import {
  mountAppShell, $, $$, click, typeInto, choose, check, settle, text, modal, lastToast, optionValues,
} from '../helpers/dom.js';

let main;

async function openAs(user, tasks = []) {
  seedWorld({ tasks });
  signInAs(user);
  main = mountAppShell();
  await initAdmin(main);
}

const rowNames = () => $$('#adm-body tbody .adm-name', main).map(text);
const sortBtn = key => $(`#adm-sort-buttons [data-sort="${key}"]`, main);
const goToTab = async tab => { click($(`.status-tab[data-tab="${tab}"]`, main)); };
const sectorBox = id => $(`#af-sectors input[value="${id}"]`);

describe('Administração — acesso', () => {
  it('quem não é do setor Admin vê "Acesso restrito"', async () => {
    await openAs(USERS.manager);
    expect(text($('.empty-title', main))).toBe('Acesso restrito');
  });
});

describe('Administração — Tipos de Atividade', () => {
  beforeEach(() => openAs(USERS.admin, [
    makeTask({ activityTypeId: 'at-dev', categoryId: 'c-bug' }),
    makeTask({ activityTypeId: 'at-dev', categoryId: 'c-bug' }),
    makeTask({ activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento' }),
  ]));

  it('lista os tipos com a quantidade de categorias e de tarefas', () => {
    expect(rowNames()).toEqual(['Desenvolvimento', 'Planejamento', 'Prospecção', 'Reunião']);
    const dev = $('#adm-body tr[data-id="at-dev"]', main);
    const [cats, tasks] = $$('.adm-num', dev).map(text);
    expect([cats, tasks]).toEqual(['2', '2']);
    expect(text($('#cnt-types', main))).toBe('4');
    expect(text($('#cnt-cats', main))).toBe('5');
  });

  it('busca por nome e "Limpar filtros" volta tudo', () => {
    typeInto($('#search-input', main), 'reun');
    expect(rowNames()).toEqual(['Reunião']);
    expect($('#adm-clear', main).classList.contains('hidden')).toBe(false);

    click($('#adm-clear', main));
    expect(rowNames()).toHaveLength(4);
    expect($('#adm-clear', main).classList.contains('hidden')).toBe(true);
  });

  it('filtro de setor usa a marcação exata (TODOS mostra só os marcados como TODOS)', () => {
    choose($('#adm-sector-filter', main), 's1');
    expect(rowNames()).toEqual(['Desenvolvimento']);
    choose($('#adm-sector-filter', main), 'ALL');
    expect(rowNames()).toEqual(['Reunião']);
  });

  it('filtro de uso: em uso x sem uso', () => {
    choose($('#adm-usage-filter', main), 'used');
    expect(rowNames()).toEqual(['Desenvolvimento', 'Reunião']);
    choose($('#adm-usage-filter', main), 'unused');
    expect(rowNames()).toEqual(['Planejamento', 'Prospecção']);
  });

  it('ordenar: clicar de novo inverte; contagens começam do maior', () => {
    expect(text(sortBtn('name'))).toBe('Nome ↑');
    click(sortBtn('name'));
    expect(rowNames()).toEqual(['Reunião', 'Prospecção', 'Planejamento', 'Desenvolvimento']);
    expect(text(sortBtn('name'))).toBe('Nome ↓');

    click(sortBtn('tasks'));
    expect(rowNames()).toEqual(['Desenvolvimento', 'Reunião', 'Planejamento', 'Prospecção']);
  });

  it('criar tipo pelo formulário grava e atualiza a tabela', async () => {
    click($('#adm-new', main));
    typeInto($('#af-name'), 'Treinamento');
    check(sectorBox('s2'));
    click($('#af-save'));
    await settle();

    expect(__all('activityTypes').find(t => t.name === 'Treinamento')).toMatchObject({ sectorIds: ['s2'] });
    expect(rowNames()).toContain('Treinamento');
    expect(lastToast()).toContain('Tipo de atividade criado!');
    expect(modal()).toBeNull();
  });

  it('erro de validação aparece no toast e o formulário continua aberto', async () => {
    click($('#adm-new', main));
    typeInto($('#af-name'), 'Reunião');
    check(sectorBox('s1'));
    click($('#af-save'));
    await settle();
    expect(lastToast()).toContain('Já existe um tipo de atividade chamado "Reunião".');
    expect(modal()).not.toBeNull();
  });

  it('editar tipo pelo formulário grava o novo nome', async () => {
    click($('#adm-body tr[data-id="at-venda"] [data-act="edit"]', main));
    expect($('#af-name').value).toBe('Prospecção');
    expect(sectorBox('s3').checked).toBe(true);
    typeInto($('#af-name'), 'Prospecção ativa');
    click($('#af-save'));
    await settle();
    expect(__doc('activityTypes', 'at-venda').name).toBe('Prospecção ativa');
    expect(lastToast()).toContain('Tipo de atividade atualizado!');
  });

  it('cancelar a confirmação não exclui nada', async () => {
    click($('#adm-body tr[data-id="at-gestao"] [data-act="del"]', main));
    click($('#cf-no'));
    await settle();
    expect(modal()).toBeNull();
    expect(__doc('activityTypes', 'at-gestao')).toBeDefined();
  });

  it('excluir pede confirmação; tipo em uso não é excluído', async () => {
    click($('#adm-body tr[data-id="at-reuniao"] [data-act="del"]', main));
    expect(text(modal())).toContain('Em uso por 1 tarefa(s)');
    click($('#cf-yes'));
    await settle();
    expect(lastToast()).toContain('1 tarefa(s) usam este tipo');
    expect(__doc('activityTypes', 'at-reuniao')).toBeDefined();
  });
});

describe('Administração — Categorias', () => {
  beforeEach(async () => {
    await openAs(USERS.admin);
    await goToTab('cats');
  });

  it('aba Categorias lista com o tipo de cada uma e filtra por tipo', () => {
    expect(rowNames()).toEqual(['Alinhamento', 'Correção de bug', 'Nova funcionalidade', 'OKRs', 'Visita a cliente']);
    expect($('#adm-type-filter', main).classList.contains('hidden')).toBe(false);
    choose($('#adm-type-filter', main), 'at-dev');
    expect(rowNames()).toEqual(['Correção de bug', 'Nova funcionalidade']);
  });

  it('trocar de aba limpa os filtros', async () => {
    typeInto($('#search-input', main), 'bug');
    await goToTab('types');
    expect($('#search-input', main).value).toBe('');
    expect($('#adm-type-filter', main).classList.contains('hidden')).toBe(true);
    expect(rowNames()).toHaveLength(4);
  });

  it('Nova Categoria: setores vêm antes e filtram os tipos de atividade', () => {
    click($('#adm-new', main));
    const sectors = $('#af-sectors');
    const typeSelect = $('#af-at');
    expect(sectors.compareDocumentPosition(typeSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(typeSelect.disabled).toBe(true);
    expect(text(typeSelect)).toBe('Selecione os setores primeiro...');

    check(sectorBox('s1'));
    expect(optionValues(typeSelect)).toEqual(['', 'at-dev', 'at-reuniao']);

    check(sectorBox('s3'));
    expect(optionValues(typeSelect)).toEqual(['', 'at-reuniao']);
  });

  it('Nova Categoria para TODOS mostra só tipos marcados como TODOS', () => {
    click($('#adm-new', main));
    check(sectorBox('ALL'));
    expect(optionValues($('#af-at'))).toEqual(['', 'at-reuniao']);
    expect(sectorBox('s1').disabled).toBe(true);
  });

  it('criar categoria pelo formulário', async () => {
    click($('#adm-new', main));
    typeInto($('#af-name'), 'Code review');
    check(sectorBox('s1'));
    choose($('#af-at'), 'at-dev');
    click($('#af-save'));
    await settle();
    expect(__all('categories').find(c => c.name === 'Code review')).toMatchObject({ activityTypeId: 'at-dev', sectorIds: ['s1'] });
    expect(lastToast()).toContain('Categoria criada!');
  });

  it('excluir categoria sem uso', async () => {
    click($('#adm-body tr[data-id="c-feature"] [data-act="del"]', main));
    click($('#cf-yes'));
    await settle();
    expect(__doc('categories', 'c-feature')).toBeUndefined();
    expect(rowNames()).not.toContain('Nova funcionalidade');
    expect(lastToast()).toContain('Categoria excluída.');
  });

  it('Editar Categoria: mantém o tipo se ele ainda atende; limpa se deixar de atender', () => {
    click($('#adm-body tr[data-id="c-bug"] [data-act="edit"]', main));
    expect(sectorBox('s1').checked).toBe(true);
    expect($('#af-at').value).toBe('at-dev');

    check(sectorBox('s1'), false);
    check(sectorBox('s3'));
    expect($('#af-at').value).toBe('');
  });
});
