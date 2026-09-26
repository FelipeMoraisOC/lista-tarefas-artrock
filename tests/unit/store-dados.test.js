// Camada de dados (store.js): cache, sessão e CRUD de tarefas.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stats, __doc, __all, __holdReads, __writes } from 'firebase/firestore';
import {
  bust, getTasks, getUsers, getCurrentUser, createTask, updateTask, patchTask, deleteTask,
  getActivityTypesForUser, getCatsForTypeAndUser,
} from '../../renderer/js/store.js';
import { seedWorld, signInAs, makeTask, makeSubtask, USERS } from '../helpers/world.js';

const reads = name => stats.getDocs.filter(n => n === name).length;

describe('cache de leitura', () => {
  beforeEach(() => seedWorld({ tasks: [makeTask({ id: 't1' })] }));

  it('lê a coleção uma vez e reaproveita o cache', async () => {
    await getTasks();
    await getTasks();
    expect(reads('tasks')).toBe(1);
  });

  it('chamadas simultâneas compartilham a mesma leitura', async () => {
    const [a, b, c] = await Promise.all([getTasks(), getTasks(), getTasks()]);
    expect(reads('tasks')).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('bust() força uma nova leitura', async () => {
    await getTasks();
    bust('tasks');
    await getTasks();
    expect(reads('tasks')).toBe(2);
  });

  it('leitura iniciada antes de um bust() não entra no cache (evita dados velhos)', async () => {
    const release = __holdReads();
    const stale = getTasks();          // começa a ler…
    bust('tasks');                     // …e uma escrita invalida o cache no meio
    release();
    await stale;
    await getTasks();
    expect(reads('tasks')).toBe(2);    // a segunda chamada leu de novo
  });

  it('devolve o id do documento junto com os dados', async () => {
    const [task] = await getTasks();
    expect(task.id).toBe('t1');
    expect(task.name).toBeDefined();
  });
});

describe('usuário logado (getCurrentUser)', () => {
  beforeEach(() => seedWorld());

  it('sem sessão → null', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('carrega o perfil pelo UID da sessão e guarda em cache', async () => {
    signInAs(USERS.dev);
    const user = await getCurrentUser();
    expect(user).toMatchObject({ id: 'u-dev', name: 'Ana Dev', sectorIds: ['s1'] });
    await getCurrentUser();
    expect(stats.getDoc).toBe(1);
  });

  it('sessão sem perfil cadastrado → null', async () => {
    signInAs({ id: 'desconhecido' });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('CRUD de tarefas', () => {
  beforeEach(() => seedWorld());

  it('createTask gera id com prefixo, datas e grava no banco', async () => {
    const task = await createTask({ type: 'task', name: 'Nova', createdById: 'u-dev' });
    expect(task.id).toMatch(/^task-/);
    expect(task.createdAt).toBe(task.updatedAt);   // senão o histórico mostra "Última atualização" numa tarefa nova
    expect(__doc('tasks', task.id)).toMatchObject({ name: 'Nova', type: 'task' });

    const sub = await createTask({ type: 'subtask', name: 'Sub', parentId: task.id });
    expect(sub.id).toMatch(/^sub-/);
  });

  it('toda escrita em tarefa avisa o app (evento tasks-changed) e limpa o cache', async () => {
    const listener = vi.fn();
    window.addEventListener('tasks-changed', listener);
    await getTasks();

    const t = await createTask({ type: 'task', name: 'A' });
    await updateTask(t.id, { name: 'B' });
    await patchTask(t.id, { hoursInvested: 1 });
    await deleteTask(t.id);

    expect(listener).toHaveBeenCalledTimes(4);
    window.removeEventListener('tasks-changed', listener);
    await getTasks();
    expect(reads('tasks')).toBe(2);
  });

  it('updateTask mescla os campos e devolve a tarefa completa', async () => {
    seedWorld({ tasks: [makeTask({ id: 't1', name: 'Antes', priority: 'Alta' })] });
    const updated = await updateTask('t1', { name: 'Depois' });
    expect(updated).toMatchObject({ id: 't1', name: 'Depois', priority: 'Alta' });
    expect(__doc('tasks', 't1').name).toBe('Depois');
  });

  it('updateTask falha com mensagem clara para tarefa inexistente', async () => {
    await expect(updateTask('nao-existe', { name: 'x' })).rejects.toThrow('Tarefa nao-existe não encontrada.');
  });

  it('patchTask grava direto, sem ler o documento antes (usado pelo timer)', async () => {
    seedWorld({ tasks: [makeTask({ id: 't1' })] });
    await patchTask('t1', { hoursInvested: 2.5 });
    expect(stats.getDoc).toBe(0);
    expect(__doc('tasks', 't1').hoursInvested).toBe(2.5);
    expect(__writes('tasks', 'updateDoc')[0].data).toMatchObject({ hoursInvested: 2.5, updatedAt: expect.any(String) });
  });

  it('deleteTask exclui a tarefa e as sub-tarefas dela, e só elas', async () => {
    const pai = makeTask({ id: 'pai' });
    const outra = makeTask({ id: 'outra' });
    seedWorld({ tasks: [pai, outra, makeSubtask(pai, { id: 'sub1' }), makeSubtask(pai, { id: 'sub2' }), makeSubtask(outra, { id: 'sub3' })] });

    await deleteTask('pai');

    expect(__all('tasks').map(t => t.id).sort()).toEqual(['outra', 'sub3']);
  });
});

describe('tipos e categorias disponíveis para o usuário', () => {
  beforeEach(() => seedWorld());

  it('tipos: os dos setores do usuário + os marcados como TODOS', async () => {
    const types = await getActivityTypesForUser(USERS.dev);
    expect(types.map(t => t.id).sort()).toEqual(['at-dev', 'at-reuniao']);
  });

  it('categorias: do tipo escolhido e visíveis para os setores do usuário', async () => {
    expect((await getCatsForTypeAndUser('at-dev', USERS.dev)).map(c => c.id).sort()).toEqual(['c-bug', 'c-feature']);
    expect(await getCatsForTypeAndUser('at-dev', USERS.sales)).toEqual([]);
    expect((await getCatsForTypeAndUser('at-reuniao', USERS.sales)).map(c => c.id)).toEqual(['c-alinhamento']);
  });

  it('getUsers lê a coleção de usuários', async () => {
    expect((await getUsers()).length).toBe(Object.keys(USERS).length);
  });
});
