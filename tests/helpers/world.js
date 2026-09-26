// ── Dados de teste: setores, usuários, tipos, categorias, tarefas ─
//
// Um "mundo" pequeno e realista da ArtRock para os testes. Use
// `seedWorld()` para gravar no Firestore falso e `signInAs()` para logar.

import { __seed } from 'firebase/firestore';
import { __setSignedIn } from 'firebase/auth';
import { bust } from '../../renderer/js/store.js';

export const SECTORS = [
  { id: 'ALL', name: 'TODOS' },
  { id: 's1', name: 'T.I' },
  { id: 's2', name: 'Backoffice Digital' },
  { id: 's3', name: 'Vendas' },
  { id: 's4', name: 'Admin' },
  { id: 's5', name: 'Gestão' },
];

export const TYPES = [
  { id: 'at-dev',     name: 'Desenvolvimento', sectorIds: ['s1'] },
  { id: 'at-reuniao', name: 'Reunião',         sectorIds: ['ALL'] },
  { id: 'at-venda',   name: 'Prospecção',      sectorIds: ['s3'] },
  { id: 'at-gestao',  name: 'Planejamento',    sectorIds: ['s5'] },
];

export const CATEGORIES = [
  { id: 'c-bug',         name: 'Correção de bug',     activityTypeId: 'at-dev',     sectorIds: ['s1'] },
  { id: 'c-feature',     name: 'Nova funcionalidade', activityTypeId: 'at-dev',     sectorIds: ['s1'] },
  { id: 'c-alinhamento', name: 'Alinhamento',         activityTypeId: 'at-reuniao', sectorIds: ['ALL'] },
  { id: 'c-cliente',     name: 'Visita a cliente',    activityTypeId: 'at-venda',   sectorIds: ['s3'] },
  { id: 'c-okr',         name: 'OKRs',                activityTypeId: 'at-gestao',  sectorIds: ['s5'] },
];

export const USERS = {
  dev:     { id: 'u-dev',    name: 'Ana Dev',      initials: 'AD', role: 'Desenvolvedora', email: 'ana@artrock.test',   sectorIds: ['s1'] },
  dev2:    { id: 'u-dev2',   name: 'Bruno TI',     initials: 'BT', role: 'Suporte',        email: 'bruno@artrock.test', sectorIds: ['s1'] },
  sales:   { id: 'u-sales',  name: 'Carla Vendas', initials: 'CV', role: 'Vendedora',      email: 'carla@artrock.test', sectorIds: ['s3'] },
  admin:   { id: 'u-admin',  name: 'Diego Admin',  initials: 'DA', role: 'Administrador',  email: 'diego@artrock.test', sectorIds: ['s4'] },
  manager: { id: 'u-gestao', name: 'Eva Gestão',   initials: 'EG', role: 'Gerente',        email: 'eva@artrock.test',   sectorIds: ['s5'] },
};

let seq = 0;

export function makeTask(overrides = {}) {
  seq++;
  return {
    id: `task-${seq}`,
    type: 'task',
    parentId: null,
    status: 'Para Fazer',
    name: `Tarefa ${seq}`,
    description: '',
    activityTypeId: 'at-dev',
    categoryId: 'c-bug',
    requesterId: null,
    responsibleId: USERS.dev.id,
    deadline: '2026-10-10',
    priority: 'Média',
    startDate: null,
    endDate: null,
    completionPercent: 0,
    hoursInvested: null,
    createdById: USERS.dev.id,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    checklist: [],
    comments: [],
    ...overrides,
  };
}

// Tarefa antiga (anterior ao Backlog): não tem o campo responsibleId.
export function makeLegacyTask(overrides = {}) {
  const { responsibleId, ...task } = makeTask(overrides);
  return task;
}

export function makeSubtask(parent, overrides = {}) {
  return makeTask({
    type: 'subtask',
    parentId: parent.id,
    activityTypeId: parent.activityTypeId,
    categoryId: parent.categoryId,
    ...overrides,
  });
}

export function seedWorld({
  tasks = [],
  users = Object.values(USERS),
  types = TYPES,
  categories = CATEGORIES,
  sectors = SECTORS,
} = {}) {
  __seed('sectors', sectors);
  __seed('users', users);
  __seed('activityTypes', types);
  __seed('categories', categories);
  __seed('tasks', tasks);
}

// Loga como o usuário (sem passar pela tela de login) e limpa o cache do store.
export function signInAs(user) {
  __setSignedIn(user ? user.id : null);
  bust();
}
