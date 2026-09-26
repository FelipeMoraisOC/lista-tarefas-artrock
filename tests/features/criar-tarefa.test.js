// Funcionalidade: Criar Tarefa (modal) — modo normal, sub-tarefa e Backlog.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __all } from 'firebase/firestore';
import { openCreateTask } from '../../renderer/js/views/modals.js';
import { seedWorld, signInAs, makeTask, USERS } from '../helpers/world.js';
import {
  mountAppShell, $, $$, click, typeInto, choose, settle, text, modal, lastToast, optionValues,
} from '../helpers/dom.js';

const me = USERS.dev;
let onSave;

async function openModal(parentId = null, parentData = null, opts = {}) {
  onSave = vi.fn();
  await openCreateTask(onSave, parentId, parentData, opts);
}

function fillRequired({ name = 'Nova tarefa', type = 'at-dev', cat = 'c-bug', deadline = '2026-10-15' } = {}) {
  typeInto($('#fc-name'), name);
  if (type) choose($('#fc-at'), type);
  if (cat) choose($('#fc-cat'), cat);
  $('#fc-deadline').value = deadline;
}

async function save() {
  click($('#mc-save'));
  await settle();
}

async function pickResponsible(userId) {
  click($('#mc-pick-resp'));
  click($(`.tc-resp-user[data-id="${userId}"]`));
  click($('#resp-confirm'));
  await settle();
}

const created = () => __all('tasks').filter(t => t.name !== 'Tarefa pai');

beforeEach(() => {
  seedWorld();
  signInAs(me);
  mountAppShell();
});

describe('Criar tarefa — modo normal', () => {
  it('tipos disponíveis são os do meu setor (+TODOS); categorias dependem do tipo', async () => {
    await openModal();
    expect(optionValues($('#fc-at'))).toEqual(['', 'at-dev', 'at-reuniao']);
    expect(text($('#fc-cat'))).toBe('Selecione o tipo primeiro...');

    choose($('#fc-at'), 'at-dev');
    expect(optionValues($('#fc-cat'))).toEqual(['', 'c-bug', 'c-feature']);
  });

  it('campos obrigatórios vazios: mostra erro e não cria nada', async () => {
    await openModal();
    await save();
    expect(lastToast()).toContain('Preencha os campos obrigatórios.');
    ['fc-name', 'fc-at', 'fc-cat', 'fc-deadline'].forEach(id =>
      expect($(`#${id}`).closest('.tc-field').classList.contains('has-error')).toBe(true));
    expect(created()).toHaveLength(0);
    expect(modal()).not.toBeNull();
  });

  it('cria a tarefa com os padrões: eu como responsável e criador, prioridade Média', async () => {
    await openModal();
    fillRequired({ name: 'Implementar exportação' });
    $('#fc-desc').value = 'Detalhes em **markdown**';
    await save();

    expect(created()).toHaveLength(1);
    expect(created()[0]).toMatchObject({
      type: 'task', parentId: null, name: 'Implementar exportação', status: 'Para Fazer',
      priority: 'Média', activityTypeId: 'at-dev', categoryId: 'c-bug', deadline: '2026-10-15',
      responsibleId: me.id, createdById: me.id, description: 'Detalhes em **markdown**',
      checklist: [], comments: [],
    });
    expect(created()[0]).not.toHaveProperty('sectorId');
    expect(onSave).toHaveBeenCalled();
    expect(modal()).toBeNull();
    expect(lastToast()).toContain('Tarefa criada!');
  });

  it('criar já "Concluído" exige Horas Investidas e preenche datas e 100%', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z'), toFake: ['Date'] });
    await openModal();
    fillRequired();
    choose($('#fc-status'), 'Concluído');
    expect($('#fc-pct').value).toBe('100');

    await save();
    expect(lastToast()).toContain('Preencha os campos obrigatórios.');
    expect(created()).toHaveLength(0);

    $('#fc-hours').value = '2.5';
    await save();
    expect(created()[0]).toMatchObject({
      status: 'Concluído', hoursInvested: 2.5, completionPercent: 100,
      startDate: '2026-09-26', endDate: '2026-09-26',
    });
  });

  it('posso escolher outra pessoa como responsável', async () => {
    await openModal();
    fillRequired();
    await pickResponsible(USERS.dev2.id);
    expect(text($('#mc-pick-resp'))).toContain('Bruno TI');
    await save();
    expect(created()[0].responsibleId).toBe(USERS.dev2.id);
  });
});

describe('Criar sub-tarefa', () => {
  const parent = makeTask({ id: 'pai', name: 'Tarefa pai', activityTypeId: 'at-dev', categoryId: 'c-feature', hoursInvested: 2, sectorId: 's1' });

  beforeEach(() => seedWorld({ tasks: [parent] }));

  it('herda tipo, categoria e setor da tarefa pai (campos travados)', async () => {
    await openModal('pai', { activityTypeId: 'at-dev', categoryId: 'c-feature', sectorId: 's1' });
    expect($('#fc-at').disabled).toBe(true);
    expect(text($('#fc-at'))).toBe('Desenvolvimento');
    expect(text($('#fc-cat'))).toBe('Nova funcionalidade');
    expect(text(modal())).toContain('herdados da tarefa pai');

    typeInto($('#fc-name'), 'Parte 1');
    $('#fc-deadline').value = '2026-10-01';
    await save();

    expect(created()[0]).toMatchObject({
      type: 'subtask', parentId: 'pai', activityTypeId: 'at-dev', categoryId: 'c-feature', sectorId: 's1',
    });
  });

  it('horas da sub-tarefa não podem passar das horas da tarefa pai', async () => {
    await openModal('pai', { activityTypeId: 'at-dev', categoryId: 'c-feature' });
    typeInto($('#fc-name'), 'Parte grande');
    $('#fc-deadline').value = '2026-10-01';
    $('#fc-hours').value = '3';
    await save();
    expect(lastToast()).toContain('não podem exceder as horas da tarefa pai');
    expect(created()).toHaveLength(0);
  });
});

describe('Criar tarefa pelo Backlog (qualquer setor, responsável opcional)', () => {
  it('o setor vem primeiro e filtra tipos; tipo e setor filtram categorias', async () => {
    await openModal(null, null, { backlog: true });
    expect(optionValues($('#fc-sector'))).toEqual(['', 's1', 's2', 's3', 's4', 's5']);
    expect(text($('#fc-at'))).toBe('Selecione o setor primeiro...');

    choose($('#fc-sector'), 's3');
    expect(optionValues($('#fc-at'))).toEqual(['', 'at-reuniao', 'at-venda']);

    choose($('#fc-at'), 'at-venda');
    expect(optionValues($('#fc-cat'))).toEqual(['', 'c-cliente']);
  });

  it('abre com o setor e o tipo que estavam selecionados na tela', async () => {
    await openModal(null, null, { backlog: true, sectorId: 's3', activityTypeId: 'at-venda' });
    expect($('#fc-sector').value).toBe('s3');
    expect($('#fc-at').value).toBe('at-venda');
    expect(optionValues($('#fc-cat'))).toEqual(['', 'c-cliente']);
  });

  it('ignora um tipo pré-selecionado que não pertence ao setor', async () => {
    await openModal(null, null, { backlog: true, sectorId: 's3', activityTypeId: 'at-dev' });
    expect($('#fc-at').value).toBe('');
  });

  it('cria sem responsável (para atribuir depois) e grava o setor', async () => {
    await openModal(null, null, { backlog: true, sectorId: 's3' });
    expect(text($('#mc-pick-resp'))).toContain('Sem responsável');
    fillRequired({ type: 'at-venda', cat: 'c-cliente' });
    await save();
    expect(created()[0]).toMatchObject({ responsibleId: null, sectorId: 's3', createdById: me.id });
  });

  it('responsáveis possíveis são do setor; trocar de setor limpa um responsável incompatível', async () => {
    await openModal(null, null, { backlog: true, sectorId: 's3' });
    click($('#mc-pick-resp'));
    expect($$('.tc-resp-user').map(el => el.dataset.id)).toEqual(['', USERS.sales.id]);
    click($(`.tc-resp-user[data-id="${USERS.sales.id}"]`));
    click($('#resp-confirm'));
    await settle();
    expect(text($('#mc-pick-resp'))).toContain('Carla Vendas');

    choose($('#fc-sector'), 's1');
    expect(text($('#mc-pick-resp'))).toContain('Sem responsável');
  });

  it('setor é obrigatório', async () => {
    await openModal(null, null, { backlog: true });
    typeInto($('#fc-name'), 'Sem setor');
    $('#fc-deadline').value = '2026-10-01';
    await save();
    expect($('#fc-sector').closest('.tc-field').classList.contains('has-error')).toBe(true);
    expect(created()).toHaveLength(0);
  });
});
