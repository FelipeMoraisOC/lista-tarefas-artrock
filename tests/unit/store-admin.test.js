// Cadastros da Administração (store.js): tipos de atividade, categorias e usuários.

import { describe, it, expect, beforeEach } from 'vitest';
import { __doc, __all } from 'firebase/firestore';
import {
  createActivityType, updateActivityType, deleteActivityType,
  createCategory, updateCategory, deleteCategory,
  typeCoversSectors, getUsageCounts, getUsers, getCurrentUser,
  createUser, updateUser,
} from '../../renderer/js/store.js';
import { seedWorld, signInAs, makeTask, USERS } from '../helpers/world.js';

beforeEach(() => seedWorld());

describe('Tipos de atividade', () => {
  it('cria com nome sem espaços extras e grava no banco', async () => {
    const at = await createActivityType({ name: '  Treinamento  ', sectorIds: ['s2'] });
    expect(at).toMatchObject({ name: 'Treinamento', sectorIds: ['s2'] });
    expect(at.id).toMatch(/^at-/);
    expect(__doc('activityTypes', at.id)).toMatchObject({ name: 'Treinamento' });
  });

  it('"TODOS" é exclusivo: marcado junto com outros setores, fica só TODOS', async () => {
    const at = await createActivityType({ name: 'Geral', sectorIds: ['s1', 'ALL', 's1'] });
    expect(at.sectorIds).toEqual(['ALL']);
  });

  it.each([
    [{ name: '   ', sectorIds: ['s1'] }, 'Informe o nome do tipo de atividade.'],
    [{ name: 'Sem setor', sectorIds: [] }, 'Selecione ao menos um setor.'],
    [{ name: 'desenvolvimento', sectorIds: ['s1'] }, 'Já existe um tipo de atividade chamado "desenvolvimento".'],
  ])('recusa dados inválidos: %o', async (payload, message) => {
    await expect(createActivityType(payload)).rejects.toThrow(message);
  });

  it('edita nome e setores; recusa nome de outro tipo', async () => {
    const updated = await updateActivityType('at-venda', { name: 'Prospecção ativa', sectorIds: ['s3', 's2'] });
    expect(updated).toMatchObject({ id: 'at-venda', name: 'Prospecção ativa', sectorIds: ['s3', 's2'] });
    await expect(updateActivityType('at-venda', { name: 'Reunião', sectorIds: ['s3'] }))
      .rejects.toThrow('Já existe um tipo de atividade chamado "Reunião".');
    await expect(updateActivityType('nao-existe', { name: 'X', sectorIds: ['s1'] }))
      .rejects.toThrow('não encontrado');
  });

  it('não exclui tipo usado por tarefas', async () => {
    seedWorld({ tasks: [makeTask({ activityTypeId: 'at-venda', categoryId: 'c-cliente' })] });
    await expect(deleteActivityType('at-venda')).rejects.toThrow('1 tarefa(s) usam este tipo');
  });

  it('não exclui tipo que ainda tem categorias', async () => {
    await expect(deleteActivityType('at-venda')).rejects.toThrow('1 categoria(s) vinculada(s)');
  });

  it('exclui tipo sem uso e sem categorias', async () => {
    const at = await createActivityType({ name: 'Temporário', sectorIds: ['s2'] });
    await deleteActivityType(at.id);
    expect(__doc('activityTypes', at.id)).toBeUndefined();
  });
});

describe('typeCoversSectors (tipo x setores da categoria)', () => {
  const tipo = sectorIds => ({ id: 't', sectorIds });

  it.each([
    ['categoria TODOS aceita só tipo TODOS', ['ALL'], ['ALL'], true],
    ['categoria TODOS recusa tipo de um setor', ['s1'], ['ALL'], false],
    ['tipo TODOS atende qualquer setor', ['ALL'], ['s1', 's3'], true],
    ['tipo precisa cobrir todos os setores marcados', ['s1', 's3'], ['s1', 's3'], true],
    ['tipo que cobre só parte dos setores é recusado', ['s1'], ['s1', 's3'], false],
    ['sem setores marcados → nenhum tipo serve', ['ALL'], [], false],
  ])('%s', (_label, typeSectors, catSectors, expected) => {
    expect(typeCoversSectors(tipo(typeSectors), catSectors)).toBe(expected);
  });
});

describe('Categorias', () => {
  it('cria categoria quando o tipo atende os setores', async () => {
    const cat = await createCategory({ name: 'Code review', activityTypeId: 'at-dev', sectorIds: ['s1'] });
    expect(cat.id).toMatch(/^c-/);
    expect(__doc('categories', cat.id)).toMatchObject({ name: 'Code review', activityTypeId: 'at-dev' });
  });

  it('recusa tipo que não atende todos os setores da categoria', async () => {
    await expect(createCategory({ name: 'X', activityTypeId: 'at-dev', sectorIds: ['s1', 's3'] }))
      .rejects.toThrow('não atende todos os setores');
  });

  it('recusa categoria sem tipo de atividade', async () => {
    await expect(createCategory({ name: 'X', activityTypeId: '', sectorIds: ['s1'] }))
      .rejects.toThrow('Selecione o tipo de atividade');
  });

  it('nome repetido é recusado no mesmo tipo, mas permitido em outro tipo', async () => {
    await expect(createCategory({ name: 'correção de BUG', activityTypeId: 'at-dev', sectorIds: ['s1'] }))
      .rejects.toThrow('Já existe uma categoria');
    await expect(createCategory({ name: 'Correção de bug', activityTypeId: 'at-reuniao', sectorIds: ['s1'] }))
      .resolves.toMatchObject({ activityTypeId: 'at-reuniao' });
  });

  it('edição também valida o tipo x setores', async () => {
    await expect(updateCategory('c-bug', { name: 'Bug', activityTypeId: 'at-dev', sectorIds: ['ALL'] }))
      .rejects.toThrow('não atende todos os setores');
    const ok = await updateCategory('c-bug', { name: 'Bug', activityTypeId: 'at-reuniao', sectorIds: ['ALL'] });
    expect(ok).toMatchObject({ id: 'c-bug', name: 'Bug', activityTypeId: 'at-reuniao', sectorIds: ['ALL'] });
  });

  it('não exclui categoria usada por tarefas; exclui quando está livre', async () => {
    seedWorld({ tasks: [makeTask({ categoryId: 'c-bug' })] });
    await expect(deleteCategory('c-bug')).rejects.toThrow('1 tarefa(s) usam esta categoria');
    await deleteCategory('c-feature');
    expect(__doc('categories', 'c-feature')).toBeUndefined();
  });

  it('getUsageCounts conta tarefas por tipo e por categoria', async () => {
    seedWorld({
      tasks: [
        makeTask({ activityTypeId: 'at-dev', categoryId: 'c-bug' }),
        makeTask({ activityTypeId: 'at-dev', categoryId: 'c-feature' }),
        makeTask({ activityTypeId: 'at-reuniao', categoryId: 'c-alinhamento' }),
      ],
    });
    expect(await getUsageCounts()).toEqual({
      byActivityType: { 'at-dev': 2, 'at-reuniao': 1 },
      byCategory: { 'c-bug': 1, 'c-feature': 1, 'c-alinhamento': 1 },
    });
  });
});

describe('Usuários', () => {
  it('cria usuário com padrões: nome = email, cargo Colaborador, setor TODOS, iniciais maiúsculas', async () => {
    const user = await createUser({ uid: 'uid-novo', email: ' novo@artrock.test ', initials: 'nv' });
    expect(user).toEqual({
      id: 'uid-novo', email: 'novo@artrock.test', name: 'novo@artrock.test',
      initials: 'NV', role: 'Colaborador', sectorIds: ['ALL'],
    });
    expect(__doc('users', 'uid-novo')).toEqual(user);
  });

  it.each([
    [{ uid: '', email: 'a@b.c', initials: 'AB' }, 'UID é obrigatório.'],
    [{ uid: 'x', email: ' ', initials: 'AB' }, 'Email é obrigatório.'],
    [{ uid: 'x', email: 'a@b.c', initials: '' }, 'Iniciais são obrigatórias.'],
  ])('recusa cadastro incompleto: %o', async (payload, message) => {
    await expect(createUser(payload)).rejects.toThrow(message);
  });

  it('recusa UID já cadastrado', async () => {
    await expect(createUser({ uid: 'u-dev', email: 'x@y.z', initials: 'XY' }))
      .rejects.toThrow('Já existe um usuário com UID "u-dev".');
  });

  it('atualiza usuário e invalida o cache (inclusive do usuário logado)', async () => {
    signInAs(USERS.dev);
    expect((await getCurrentUser()).role).toBe('Desenvolvedora');
    await getUsers();

    await updateUser('u-dev', { role: 'Tech Lead' });

    expect((await getCurrentUser()).role).toBe('Tech Lead');
    expect((await getUsers()).find(u => u.id === 'u-dev').role).toBe('Tech Lead');
    expect(__all('users').find(u => u.id === 'u-dev').role).toBe('Tech Lead');
  });

  it('não atualiza usuário inexistente', async () => {
    await expect(updateUser('fantasma', { role: 'x' })).rejects.toThrow('Usuário fantasma não encontrado.');
  });
});
