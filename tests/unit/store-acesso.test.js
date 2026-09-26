// Controle de acesso (store.js): Admin, Gestão, setor da tarefa e permissão de edição.

import { describe, it, expect } from 'vitest';
import {
  isAdmin, isManager, getRestrictedSectorIds, taskSectorId, canEditTask,
} from '../../renderer/js/store.js';
import { USERS, makeTask, makeLegacyTask, makeSubtask } from '../helpers/world.js';

const users = Object.values(USERS);

describe('perfis de acesso', () => {
  it.each([
    ['Admin (s4)', USERS.admin, true],
    ['Gestão (s5)', USERS.manager, false],
    ['T.I (s1)', USERS.dev, false],
    ['sem setores', { id: 'x' }, false],
    ['sem usuário', null, false],
  ])('isAdmin — %s', async (_label, user, expected) => {
    expect(await isAdmin(user)).toBe(expected);
  });

  it.each([
    ['Admin (s4)', USERS.admin, true],
    ['Gestão (s5)', USERS.manager, true],
    ['Admin e T.I', { id: 'x', sectorIds: ['s1', 's4'] }, true],
    ['Vendas (s3)', USERS.sales, false],
    ['sem usuário', null, false],
  ])('isManager (acesso total às tarefas) — %s', async (_label, user, expected) => {
    expect(await isManager(user)).toBe(expected);
  });

  it('setores restritos no Backlog são Admin e Gestão (mesmos IDs das regras do Firestore)', async () => {
    expect(await getRestrictedSectorIds()).toEqual(['s4', 's5']);
  });
});

describe('taskSectorId (setor de uma tarefa)', () => {
  it('usa o setor gravado na tarefa (criada pelo Backlog)', () => {
    expect(taskSectorId(makeTask({ sectorId: 's3' }), users)).toBe('s3');
  });

  it('sem setor gravado, usa o primeiro setor do responsável', () => {
    expect(taskSectorId(makeTask({ responsibleId: USERS.sales.id, createdById: USERS.dev.id }), users)).toBe('s3');
  });

  it('sem responsável, usa o setor de quem criou', () => {
    expect(taskSectorId(makeTask({ responsibleId: null, createdById: USERS.manager.id }), users)).toBe('s5');
  });

  it('ignora o setor TODOS e devolve null quando não dá para saber', () => {
    const allOnly = { id: 'u-all', sectorIds: ['ALL'] };
    const task = makeTask({ responsibleId: 'u-all', createdById: 'u-all' });
    expect(taskSectorId(task, [allOnly])).toBeNull();
  });
});

describe('canEditTask (quem pode editar/excluir)', () => {
  const task = makeTask({ createdById: USERS.dev.id, responsibleId: USERS.sales.id });

  it('quem criou pode editar', () => {
    expect(canEditTask(task, USERS.dev, false)).toBe(true);
  });

  it('o responsável pode editar, mesmo sem ter criado', () => {
    expect(canEditTask(task, USERS.sales, false)).toBe(true);
  });

  it('Admin/Gestão pode editar qualquer tarefa', () => {
    expect(canEditTask(task, USERS.manager, true)).toBe(true);
  });

  it('outras pessoas só visualizam', () => {
    expect(canEditTask(task, USERS.dev2, false)).toBe(false);
  });

  it('sem usuário logado, só visualiza (não quebra)', () => {
    expect(canEditTask(task, null, false)).toBe(false);
  });

  it('tarefa antiga (sem responsibleId) tem o criador como responsável', () => {
    expect(canEditTask(makeLegacyTask({ createdById: USERS.dev.id }), USERS.dev, false)).toBe(true);
  });

  it('sub-tarefa pode ser editada por quem gerencia a tarefa pai', () => {
    const parent = makeTask({ createdById: USERS.admin.id, responsibleId: USERS.dev2.id });
    const sub = makeSubtask(parent, { createdById: USERS.admin.id, responsibleId: USERS.admin.id });
    expect(canEditTask(sub, USERS.dev2, false, parent)).toBe(true);
    expect(canEditTask(sub, USERS.sales, false, parent)).toBe(false);
  });
});
