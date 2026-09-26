// Funcionalidade: Detalhe da Tarefa (modal) — edição, permissões, comentários,
// checklist, sub-tarefas, responsável e exclusão.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __doc, __all } from 'firebase/firestore';
import { openTaskDetail } from '../../renderer/js/views/modals.js';
import { createTask } from '../../renderer/js/store.js';
import { seedWorld, signInAs, makeTask, makeLegacyTask, makeSubtask, USERS } from '../helpers/world.js';
import {
  mountAppShell, $, $$, click, typeInto, choose, check, settle, waitFor, text, modal, lastToast, optionValues, pressKey,
} from '../helpers/dom.js';

let onSave;

async function openAs(user, task, others = []) {
  seedWorld({ tasks: [task, ...others] });
  signInAs(user);
  mountAppShell();
  onSave = vi.fn();
  await openTaskDetail(task, onSave);
}

const saveBtn = () => $('#dd-save');
const isVisible = el => el.style.display !== 'none';
const isReadOnly = () => modal().classList.contains('tc-readonly');

async function save() {
  click(saveBtn());
  await settle();
}

async function rename(value) {
  click($('#dd-name-view'));
  $('#dd-name-input').value = value;
  $('#dd-name-input').dispatchEvent(new Event('blur'));
}

describe('Detalhe da tarefa — visualizar e editar', () => {
  it('mostra os dados da tarefa e quem criou', async () => {
    await openAs(USERS.dev, makeTask({
      name: 'Migrar banco', status: 'Em Andamento', priority: 'Alta', deadline: '2026-10-20',
      description: 'Passo a passo', createdById: USERS.dev.id,
    }));
    expect(text($('#dd-name-view'))).toBe('Migrar banco');
    expect($('#dd-status').value).toBe('Em Andamento');
    expect($('#dd-priority').value).toBe('Alta');
    expect($('#dd-deadline').value).toBe('2026-10-20');
    expect(text($('#dd-desc-view'))).toBe('Passo a passo');
    expect(text($('.tc-side-info'))).toContain('Criado por AD Ana Dev');
  });

  it('o botão Salvar só aparece depois de alguma mudança', async () => {
    await openAs(USERS.dev, makeTask({ name: 'Antigo' }));
    expect(isVisible(saveBtn())).toBe(false);
    await rename('Novo nome');
    expect(isVisible(saveBtn())).toBe(true);
  });

  it('editar o nome e salvar grava no banco e avisa a tela de origem', async () => {
    const task = makeTask({ name: 'Antigo' });
    await openAs(USERS.dev, task);
    await rename('Nome corrigido');
    await save();
    expect(__doc('tasks', task.id).name).toBe('Nome corrigido');
    expect(lastToast()).toContain('Tarefa atualizada!');
    expect(onSave).toHaveBeenCalled();
  });

  it('Esc no nome desfaz a edição', async () => {
    await openAs(USERS.dev, makeTask({ name: 'Original' }));
    click($('#dd-name-view'));
    $('#dd-name-input').value = 'Rascunho';
    pressKey($('#dd-name-input'), 'Escape');
    expect(text($('#dd-name-view'))).toBe('Original');
    expect(isVisible(saveBtn())).toBe(false);
  });

  it('concluir exige Horas Investidas (datas e 100% são preenchidos sozinhos)', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z'), toFake: ['Date'] });
    const task = makeTask({ status: 'Em Andamento' });
    await openAs(USERS.dev, task);

    choose($('#dd-status'), 'Concluído');
    expect($('#dd-start').value).toBe('2026-09-26');
    expect($('#dd-end').value).toBe('2026-09-26');
    expect($('#dd-pct').value).toBe('100');

    await save();
    expect(lastToast()).toContain('Preencha Horas Investidas');
    expect(__doc('tasks', task.id).status).toBe('Em Andamento');

    choose($('#dd-hours'), '3');
    await save();
    expect(__doc('tasks', task.id)).toMatchObject({ status: 'Concluído', hoursInvested: 3, completionPercent: 100 });
  });

  it('Horas Investidas aparecem com no máximo 2 casas', async () => {
    await openAs(USERS.dev, makeTask({ hoursInvested: 1.234567 }));
    expect($('#dd-hours').value).toBe('1.23');
  });

  it('editar a descrição funciona mesmo sem o editor rico carregado (ex.: sem internet)', async () => {
    const task = makeTask({ description: '' });
    await openAs(USERS.dev, task);
    click($('#dd-desc-toggle'));
    typeInto($('#dd-desc-ta'), 'Nova descrição');
    expect(isVisible(saveBtn())).toBe(true);
    await save();
    expect(__doc('tasks', task.id).description).toBe('Nova descrição');
  });
});

describe('Detalhe da tarefa — outros controles', () => {
  it('trocar o tipo de atividade troca as categorias (e escolhe a primeira)', async () => {
    const task = makeTask({ activityTypeId: 'at-dev', categoryId: 'c-feature' });
    await openAs(USERS.dev, task);
    choose($('#dd-at'), 'at-reuniao');
    expect(optionValues($('#dd-cat'))).toEqual(['c-alinhamento']);
    await save();
    expect(__doc('tasks', task.id)).toMatchObject({ activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento' });
  });

  it('o círculo ao lado do nome marca e desmarca como concluída', async () => {
    await openAs(USERS.dev, makeTask({ status: 'Em Andamento' }));
    click($('#dd-check'));
    expect($('#dd-status').value).toBe('Concluído');
    expect(modal().classList.contains('tc-is-done')).toBe(true);
    click($('#dd-check'));
    expect($('#dd-status').value).toBe('Para Fazer');
  });

  it('prioridade, prazo, solicitante e datas são salvos', async () => {
    const task = makeTask();
    await openAs(USERS.dev, task);
    choose($('#dd-priority'), 'Baixa');
    choose($('#dd-deadline'), '2026-12-01');
    choose($('#dd-req'), USERS.sales.id);
    choose($('#dd-start'), '2026-09-20');
    await save();
    expect(__doc('tasks', task.id)).toMatchObject({
      priority: 'Baixa', deadline: '2026-12-01', requesterId: USERS.sales.id, startDate: '2026-09-20',
    });
  });

  it('tarefa recém-criada não mostra "Última atualização" no histórico', async () => {
    seedWorld();
    signInAs(USERS.dev);
    mountAppShell();
    const nova = await createTask(makeTask({ id: undefined, name: 'Recém-criada' }));
    await openTaskDetail(nova, vi.fn());
    expect(text($('#dd-feed'))).toContain('criou esta tarefa');
    expect(text($('#dd-feed'))).not.toContain('Última atualização');
  });

  it('"Ocultar Detalhes" esconde os registros automáticos do histórico', async () => {
    await openAs(USERS.dev, makeTask());
    expect(text($('#dd-feed'))).toContain('criou esta tarefa');
    click($('#dd-activity-toggle'));
    expect(text($('#dd-feed'))).not.toContain('criou esta tarefa');
    expect(text($('#dd-activity-toggle'))).toBe('Mostrar Detalhes');
  });

  it('comentário com Ctrl+Enter é enviado; Esc descarta', async () => {
    const task = makeTask();
    await openAs(USERS.dev, task);
    $('#dd-comment').value = 'Rascunho que vou apagar';
    pressKey($('#dd-comment'), 'Escape');
    expect($('#dd-comment').value).toBe('');

    $('#dd-comment').value = 'Enviado pelo atalho';
    pressKey($('#dd-comment'), 'Enter', { ctrlKey: true });
    await settle();
    expect(__doc('tasks', task.id).comments.map(c => c.text)).toEqual(['Enviado pelo atalho']);
  });

  it('fechar a edição da descrição mostra o texto novo', async () => {
    await openAs(USERS.dev, makeTask({ description: '' }));
    click($('#dd-desc-toggle'));
    typeInto($('#dd-desc-ta'), 'Texto novo');
    click($('#dd-desc-close'));
    expect(isVisible($('#dd-desc-view'))).toBe(true);
    expect(text($('#dd-desc-view'))).toBe('Texto novo');
  });

  it('rascunho da descrição fica guardado no computador até salvar', async () => {
    const task = makeTask({ description: 'Original' });
    await openAs(USERS.dev, task);
    click($('#dd-desc-toggle'));
    typeInto($('#dd-desc-ta'), 'Rascunho');
    expect(localStorage.getItem(`artrock:task-description-draft:${task.id}`)).toBe('Rascunho');
    await save();
    expect(localStorage.getItem(`artrock:task-description-draft:${task.id}`)).toBeNull();
  });
});

describe('Detalhe da tarefa — permissões', () => {
  const task = () => makeTask({ createdById: USERS.dev.id, responsibleId: USERS.sales.id });

  it.each([
    ['quem criou', USERS.dev],
    ['o responsável', USERS.sales],
    ['o setor Gestão', USERS.manager],
    ['o setor Admin', USERS.admin],
  ])('%s pode editar', async (_label, user) => {
    await openAs(user, task());
    expect(isReadOnly()).toBe(false);
    expect($('#dd-status').disabled).toBe(false);
  });

  it('outras pessoas abrem em modo visualização: tudo travado, sem salvar/excluir', async () => {
    const t = task();
    await openAs(USERS.dev2, t);
    expect(isReadOnly()).toBe(true);
    expect(text($('.tc-readonly-note'))).toContain('Modo visualização');
    ['#dd-status', '#dd-priority', '#dd-deadline', '#dd-hours', '#dd-check'].forEach(sel =>
      expect($(sel).disabled).toBe(true));
    expect($('#dd-resp-container .ss-trigger').disabled).toBe(true);

    click($('#dd-name-view'));
    expect(isVisible($('#dd-name-input'))).toBe(false);
    expect(isVisible(saveBtn())).toBe(false);
  });

  it('tarefa antiga (sem responsibleId): o criador aparece e age como responsável', async () => {
    await openAs(USERS.dev, makeLegacyTask({ createdById: USERS.dev.id }));
    expect(isReadOnly()).toBe(false);
    expect(text($('#dd-resp-container .ss-trigger-text'))).toBe('Ana Dev');
  });

  it('sub-tarefa pode ser editada por quem é responsável pela tarefa pai', async () => {
    const parent = makeTask({ createdById: USERS.admin.id, responsibleId: USERS.dev2.id });
    const sub = makeSubtask(parent, { createdById: USERS.admin.id, responsibleId: USERS.admin.id });
    await openAs(USERS.dev2, sub, [parent]);
    expect(isReadOnly()).toBe(false);
    expect(text(modal())).toContain(`Sub-tarefa de: ${parent.name}`);
  });
});

describe('Detalhe da tarefa — responsável, comentários e checklist', () => {
  it('posso deixar a tarefa "Sem responsável"; fica registrado no histórico', async () => {
    const task = makeTask({ responsibleId: USERS.dev.id });
    await openAs(USERS.dev, task);
    click($('#dd-resp-container .ss-trigger'));
    click($('#dd-resp-container .ss-option[data-value=""]'));
    expect(text($('#dd-feed'))).toContain('alterou o responsável de Ana Dev para Sem responsável');

    await save();
    expect(__doc('tasks', task.id).responsibleId).toBeNull();
  });

  it('comentário é salvo na hora e aparece no histórico', async () => {
    const task = makeTask();
    await openAs(USERS.dev, task);
    $('#dd-comment').value = 'Aguardando retorno do cliente';
    click($('#dd-comment-save'));
    await settle();
    expect(__doc('tasks', task.id).comments).toEqual([
      expect.objectContaining({ userId: USERS.dev.id, text: 'Aguardando retorno do cliente' }),
    ]);
    expect(text($('#dd-feed'))).toContain('Aguardando retorno do cliente');
  });

  it('checklist: adicionar, marcar e ver o progresso', async () => {
    const task = makeTask();
    await openAs(USERS.dev, task);
    click($('#dd-add-check'));
    typeInto($('#dd-check-input'), 'Escrever testes');
    click($('#dd-check-add-btn'));
    typeInto($('#dd-check-input'), 'Revisar PR');
    click($('#dd-check-add-btn'));
    expect(text($('#dd-check-count'))).toBe('0/2');

    check($$('#dd-check-list input[type="checkbox"]')[0]);
    expect(text($('#dd-check-count'))).toBe('1/2');
    expect(text($('#dd-check-pct'))).toBe('50%');

    await save();
    expect(__doc('tasks', task.id).checklist).toEqual([
      expect.objectContaining({ text: 'Escrever testes', done: true }),
      expect.objectContaining({ text: 'Revisar PR', done: false }),
    ]);
  });
});

describe('Detalhe da tarefa — sub-tarefas, Backlog e exclusão', () => {
  it('lista as sub-tarefas e abre a sub-tarefa ao clicar', async () => {
    const parent = makeTask({ name: 'Pai' });
    await openAs(USERS.dev, parent, [makeSubtask(parent, { name: 'Filha 1' }), makeSubtask(parent, { name: 'Filha 2' })]);
    expect($$('#dd-sub-list .subtask-name').map(text)).toEqual(['Filha 1', 'Filha 2']);

    click($$('#dd-sub-list .subtask-item')[1]);
    await waitFor(() => expect(text($('#dd-name-view'))).toBe('Filha 2'));
    expect(text(modal())).toContain('Sub-tarefa de: Pai');
  });

  it('tarefa do Backlog mostra o setor e oferece os tipos do setor dela', async () => {
    const task = makeTask({ sectorId: 's3', activityTypeId: 'at-venda', categoryId: 'c-cliente', createdById: USERS.dev.id });
    await openAs(USERS.dev, task);
    expect(text($('.tc-side-info'))).toContain('Setor Vendas');
    expect(optionValues($('#dd-at')).sort()).toEqual(['at-reuniao', 'at-venda']);
  });

  it('excluir pede para digitar "excluir" e apaga a tarefa com as sub-tarefas', async () => {
    const parent = makeTask({ id: 'apagar' });
    const outra = makeTask({ id: 'fica' });
    await openAs(USERS.dev, parent, [makeSubtask(parent, { id: 'sub-apagar' }), outra]);

    click($('#dd-delete'));
    expect($('#dd-delete-confirm-btn').disabled).toBe(true);
    typeInto($('#dd-delete-input'), 'EXCLUIR');
    expect($('#dd-delete-confirm-btn').disabled).toBe(false);
    click($('#dd-delete-confirm-btn'));
    await settle();

    expect(__all('tasks').map(t => t.id)).toEqual(['fica']);
    expect(lastToast()).toContain('Tarefa excluída!');
    expect(onSave).toHaveBeenCalled();
  });
});
