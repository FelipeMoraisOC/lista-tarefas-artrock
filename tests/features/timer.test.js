// Funcionalidade: Timer das tarefas em andamento (menu lateral).
//
// Relógio simulado (vi.useFakeTimers): avançamos segundos, minutos e horas
// na hora, e simulamos app fechado, computador suspenso e falta de internet.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __doc, __seed, __writes, __failNext, __setOffline, stats } from 'firebase/firestore';
import {
  initTaskTimer, teardownTaskTimer, flushTaskTimer, stopTaskTimer, setTimerEnabled,
} from '../../renderer/js/components/task-timer.js';
import { bust, createTask, updateTask, deleteTask } from '../../renderer/js/store.js';
import { openTaskDetail } from '../../renderer/js/views/modals.js';
import { seedWorld, signInAs, makeTask, makeSubtask, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, choose, text, modal, lastToast } from '../helpers/dom.js';

const me = USERS.dev;
const START = new Date('2026-09-26T12:00:00Z');
const STORAGE_KEY = `artrock:timer:${me.id}`;

const taskA = () => makeTask({ id: 'A', name: 'Tarefa A', status: 'Em Andamento', hoursInvested: 1.5 });
const taskB = () => makeTask({ id: 'B', name: 'Tarefa B', status: 'Em Andamento', hoursInvested: null });

let onDataChanged;

async function startWith(tasks = [taskA(), taskB()]) {
  seedWorld({ tasks });
  mountAppShell();
  onDataChanged = vi.fn();
  await initTaskTimer(me, { onDataChanged });
}

const flush       = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
const secondsOf   = id => Math.round((__doc('tasks', id).hoursInvested ?? 0) * 3600);
const hourWrites  = id => __writes('tasks', 'updateDoc').filter(w => w.id === id && 'hoursInvested' in w.data);
const items       = () => $$('#task-timer .tt-item').map(el => el.dataset.id);
const timeOf      = id => text($(`#task-timer [data-time="${id}"]`));
const runningId   = () => $('#task-timer .tt-item.is-running')?.dataset.id ?? null;
const toggle      = () => click($('#tt-toggle'));
const savedState  = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

// ── Arrastar: posições falsas (jsdom não calcula layout) ──
const rect = (top, height) => ({ top, height, bottom: top + height, left: 0, right: 200, width: 200, x: 0, y: top });

function fakeLayout() {
  $('#task-timer .tt-done-zone').getBoundingClientRect = () => rect(430, 50);   // zona "Concluir" termina em y=480
  $$('#task-timer .tt-item').forEach((el, i) => { el.getBoundingClientRect = () => rect(500 + i * 30, 26); });
}

function pointer(el, type, clientY) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientY, pointerId: 1 }));
}

function dragTo(id, toY) {
  fakeLayout();
  const item = $(`#task-timer .tt-item[data-id="${id}"]`);
  const fromY = item.getBoundingClientRect().top + 13;
  pointer(item, 'pointerdown', fromY);
  pointer(item, 'pointermove', fromY - 8);
  pointer(item, 'pointermove', toY);
  pointer(item, 'pointerup', toY);
}

function rightClick(id) {
  $(`#task-timer .tt-item[data-id="${id}"]`)
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
}

beforeEach(() => {
  vi.useFakeTimers({ now: START });
  signInAs(me);
});

describe('Timer — painel', () => {
  it('lista só as MINHAS tarefas "Em Andamento", com o tempo acumulado', async () => {
    const a = taskA();
    await startWith([
      a, taskB(),
      makeTask({ id: 'C', status: 'Para Fazer' }),
      makeTask({ id: 'D', status: 'Em Andamento', responsibleId: USERS.sales.id }),
      makeSubtask(a, { id: 'S', status: 'Em Andamento' }),
    ]);
    expect(items()).toEqual(['A', 'B']);
    expect(timeOf('A')).toBe('1:30:00');
    expect(timeOf('B')).toBe('0:00');
    expect(text($('#task-timer .tt-count'))).toBe('2');
    expect($('#task-timer .tt-item.is-top').dataset.id).toBe('A');
  });

  it('sem tarefas em andamento: aviso e botões desativados', async () => {
    await startWith([]);
    expect(text($('#task-timer .tt-empty'))).toBe('Nenhuma tarefa em andamento.');
    expect($('#tt-toggle').disabled).toBe(true);
    expect($('#tt-view').disabled).toBe(true);
  });

  it('desativado nas Configurações: o painel nem aparece', async () => {
    localStorage.setItem(`artrock:timer-enabled:${me.id}`, '0');
    await startWith();
    expect($('#task-timer').classList.contains('hidden')).toBe(true);
  });

  it('"Ver ativa" abre o detalhe da tarefa do topo', async () => {
    await startWith();
    click($('#tt-view'));
    await vi.waitFor(() => expect(modal()).not.toBeNull());
    expect(text($('#dd-name-view'))).toBe('Tarefa A');
  });
});

describe('Timer — contar e pausar', () => {
  it('Iniciar: a tarefa do topo conta a cada segundo', async () => {
    await startWith();
    toggle();
    expect(runningId()).toBe('A');
    expect($('#tt-toggle').getAttribute('aria-label')).toBe('Pausar o timer');
    await flush(3000);
    expect(timeOf('A')).toBe('1:30:03');
  });

  it('enquanto roda, NÃO grava no Firebase (só nos momentos certos)', async () => {
    await startWith();
    toggle();
    await flush(10 * 60 * 1000);
    expect(hourWrites('A')).toHaveLength(0);
  });

  it('Pausar grava o total em Horas Investidas e preenche a Data de Início', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    toggle();
    await flush(300);
    expect(secondsOf('A')).toBe(5400 + 10);
    expect(__doc('tasks', 'A').startDate).toBe('2026-09-26');
    expect(runningId()).toBeNull();
  });

  it('pausar em menos de 1 segundo não grava nada', async () => {
    await startWith();
    toggle();
    toggle();
    await flush(300);
    expect(hourWrites('A')).toHaveLength(0);
  });

  it('relógio do sistema voltando não apaga nem subtrai tempo', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    vi.setSystemTime(Date.now() - 60 * 60 * 1000);   // relógio voltou 1 hora
    await flush(2000);
    toggle();
    await flush(300);
    expect(secondsOf('A')).toBeGreaterThanOrEqual(5400 + 10);
    expect(secondsOf('A')).toBeLessThanOrEqual(5400 + 12);
  });
});

describe('Timer — arrastar', () => {
  it('arrastar outra tarefa para o topo troca a ativa e salva a anterior', async () => {
    await startWith();
    toggle();
    await flush(60_000);

    dragTo('B', 505);
    await flush(300);

    expect(items()).toEqual(['B', 'A']);
    expect(secondsOf('A')).toBe(5400 + 60);
    expect(runningId()).toBe('B');
    await flush(5000);
    expect(timeOf('B')).toBe('0:05');
  });

  it('soltar no mesmo lugar não muda nada nem grava', async () => {
    await startWith();
    dragTo('B', 535);
    await flush(300);
    expect(items()).toEqual(['A', 'B']);
    expect(__writes('tasks')).toHaveLength(0);
  });

  it('clique simples (sem arrastar) abre o detalhe da tarefa', async () => {
    await startWith();
    const b = $('#task-timer .tt-item[data-id="B"]');
    pointer(b, 'pointerdown', 543);
    pointer(b, 'pointerup', 543);
    await vi.waitFor(() => expect(modal()).not.toBeNull());
    expect(text($('#dd-name-view'))).toBe('Tarefa B');
  });

  it('arrastar para cima da lista conclui a tarefa e a próxima começa sozinha', async () => {
    await startWith();
    toggle();
    await flush(30_000);

    dragTo('A', 470);
    expect($('#task-timer').classList.contains('is-over-done')).toBe(false);
    expect($('#task-timer .tt-item[data-id="A"]').classList.contains('is-completing')).toBe(true);
    await flush(420 + 300);

    expect(__doc('tasks', 'A')).toMatchObject({
      status: 'Concluído', completionPercent: 100, startDate: '2026-09-26', endDate: '2026-09-26',
    });
    expect(secondsOf('A')).toBe(5400 + 30);
    expect(items()).toEqual(['B']);
    expect(runningId()).toBe('B');
    expect(lastToast()).toContain('"Tarefa A" concluída. O timer seguiu para "Tarefa B".');
    expect(lastToast()).toContain('Desfazer');
    expect(onDataChanged).toHaveBeenCalled();
  });

  it('"Desfazer" devolve a tarefa ao topo e o timer volta para ela', async () => {
    await startWith();
    toggle();
    await flush(30_000);
    dragTo('A', 470);
    await flush(420 + 300);
    await flush(5000);                       // B contou 5s (o "Desfazer" fica 7s na tela)

    click($('#toast-container .toast-action'));
    await flush(300);

    expect(__doc('tasks', 'A')).toMatchObject({ status: 'Em Andamento', endDate: null, completionPercent: 0 });
    expect(items()).toEqual(['A', 'B']);
    expect(runningId()).toBe('A');
    expect(secondsOf('B')).toBe(5);
    expect(secondsOf('A')).toBe(5400 + 30);
  });

  it('o "Desfazer" some depois de alguns segundos', async () => {
    await startWith();
    toggle();
    await flush(30_000);
    dragTo('A', 470);
    await flush(420 + 300);
    await flush(8000);
    expect($('#toast-container .toast-action')).toBeNull();
  });

  it('não conclui tarefa sem nenhum tempo registrado', async () => {
    await startWith();
    dragTo('B', 470);
    await flush(500);
    expect(lastToast()).toContain('Registre algum tempo nesta tarefa antes de concluí-la.');
    expect(__doc('tasks', 'B').status).toBe('Em Andamento');
    expect(items()).toEqual(['A', 'B']);
  });
});

describe('Timer — teclado', () => {
  it('Enter numa tarefa da lista abre o detalhe', async () => {
    await startWith();
    $('#task-timer .tt-item[data-id="B"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(modal()).not.toBeNull());
    expect(text($('#dd-name-view'))).toBe('Tarefa B');
  });
});

describe('Timer — botão direito (adicionar tempo)', () => {
  it('+5 min na tarefa que está contando soma e grava na hora', async () => {
    await startWith();
    toggle();
    await flush(60_000);
    rightClick('A');
    click($$('.tt-menu .tt-menu-item').find(b => b.dataset.add === '5'));
    await flush(0);
    expect(secondsOf('A')).toBe(5400 + 60 + 300);
    expect(lastToast()).toContain('+5 min em "Tarefa A"');
    expect($('.tt-menu')).toBeNull();
  });

  it('+10 min numa tarefa parada grava na hora', async () => {
    await startWith();
    rightClick('B');
    click($$('.tt-menu .tt-menu-item').find(b => b.dataset.add === '10'));
    await flush(0);
    expect(secondsOf('B')).toBe(600);
    expect(timeOf('B')).toBe('10:00');
  });

  it('o menu também abre os detalhes e fecha com Esc', async () => {
    await startWith();
    rightClick('B');
    expect($$('.tt-menu-item').map(text)).toEqual(['+ 5 min', '+ 10 min', '+ 15 min', '+ 30 min', 'Abrir detalhes']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('.tt-menu')).toBeNull();

    rightClick('B');
    click($('.tt-menu [data-open]'));
    await vi.waitFor(() => expect(modal()).not.toBeNull());
  });
});

describe('Timer — acompanha as mudanças no resto do app', () => {
  it('tarefa nova "Em Andamento" entra no fim da lista, sem roubar o timer', async () => {
    await startWith();
    toggle();
    await createTask({ type: 'task', name: 'Nova', status: 'Em Andamento', responsibleId: me.id, createdById: me.id });
    await flush(300);
    expect(items()).toHaveLength(3);
    expect(items()[2]).toMatch(/^task-/);
    expect(runningId()).toBe('A');
  });

  it('tarefa ativa concluída em outra tela: salva o tempo e passa para a próxima', async () => {
    await startWith();
    toggle();
    await flush(20_000);
    await updateTask('A', { status: 'Concluído' });
    await flush(300);
    expect(secondsOf('A')).toBe(5400 + 20);
    expect(__doc('tasks', 'A').status).toBe('Concluído');
    expect(runningId()).toBe('B');
  });

  it('sem mais tarefas em andamento, o timer pausa e avisa', async () => {
    await startWith([taskA()]);
    toggle();
    await flush(5000);
    await updateTask('A', { status: 'Para Fazer' });
    await flush(300);
    expect(runningId()).toBeNull();
    expect(lastToast()).toContain('Timer pausado: não há mais tarefas em andamento.');
    expect(secondsOf('A')).toBe(5400 + 5);
  });

  it('tarefa ativa excluída: não tenta gravar nela e segue para a próxima', async () => {
    await startWith();
    toggle();
    await flush(5000);
    await deleteTask('A');
    await flush(300);
    expect(hourWrites('A')).toHaveLength(0);
    expect(runningId()).toBe('B');
    expect(lastToast()).not.toContain('Não foi possível');
  });

  it('várias gravações seguidas geram uma única releitura das tarefas', async () => {
    await startWith();
    const before = stats.getDocs.filter(n => n === 'tasks').length;
    for (let i = 0; i < 3; i++) {           // como o store faz a cada escrita
      bust('tasks');
      window.dispatchEvent(new Event('tasks-changed'));
    }
    await flush(300);
    expect(stats.getDocs.filter(n => n === 'tasks').length).toBe(before + 1);
  });
});

describe('Timer — nunca perder tempo', () => {
  it('recarregar o app (volta em até 2 min) continua contando de onde parou', async () => {
    await startWith();
    toggle();
    await flush(20_000);
    teardownTaskTimer();                       // app recarregando…
    vi.setSystemTime(Date.now() + 30_000);     // …30s depois
    await initTaskTimer(me, {});
    expect(runningId()).toBe('A');
    toggle();
    await flush(300);
    expect(secondsOf('A')).toBe(5400 + 50);
  });

  it('app fechado de repente (travou) por mais de 2 min: credita até o último registro e pausa', async () => {
    await startWith();
    toggle();
    await flush(31_000);                       // o batimento é salvo no aparelho a cada 10s: em 1s, 11s, 21s e 31s
    teardownTaskTimer();                       // app fechou sem aviso
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
    await initTaskTimer(me, {});
    await flush(300);

    expect(runningId()).toBeNull();
    expect(secondsOf('A')).toBe(5400 + 31);
    expect(lastToast()).toContain('pausado porque o app foi fechado');
  });

  it('mesmo com o relógio do sistema voltando, o batimento continua sendo salvo', async () => {
    await startWith();
    toggle();
    await flush(12_000);
    vi.setSystemTime(Date.now() - 30 * 60 * 1000);   // relógio voltou 30 min
    await flush(1000);
    expect(savedState().st.lastBeat).toBe(Date.now());
  });

  it('computador suspenso (5+ min sem batimento): pausa e não conta o tempo dormindo', async () => {
    await startWith();
    toggle();
    await flush(5000);
    vi.setSystemTime(Date.now() + 40 * 60 * 1000);   // dormiu 40 min sem os timers rodarem
    await flush(1000);
    await flush(300);
    expect(runningId()).toBeNull();
    expect(secondsOf('A')).toBe(5400 + 5);
    expect(lastToast()).toContain('o computador ficou inativo');
  });

  it('fechar o app (flush) grava o total e o timer segue "rodando" para um reinício rápido', async () => {
    await startWith();
    toggle();
    await flush(45_000);
    await flushTaskTimer();
    expect(secondsOf('A')).toBe(5400 + 45);
    expect(savedState().st).toMatchObject({ running: true, activeId: 'A' });
  });

  it('sair da conta pausa, grava e esconde o painel', async () => {
    await startWith();
    toggle();
    await flush(15_000);
    await stopTaskTimer();
    expect(secondsOf('A')).toBe(5400 + 15);
    expect($('#task-timer').classList.contains('hidden')).toBe(true);
    expect(savedState().st.running).toBe(false);
  });

  it('sem internet: a gravação fica guardada no aparelho e é reenviada ao reabrir', async () => {
    await startWith();
    toggle();
    await flush(20_000);
    __setOffline(true);
    toggle();                                  // pausa → gravação fica pendente
    await flush(300);
    expect(savedState().pending.A.hoursInvested * 3600).toBeCloseTo(5420, 0);

    // app fechou antes de o Firestore guardar a escrita: o banco ficou com o valor antigo
    __seed('tasks', [{ ...__doc('tasks', 'A'), hoursInvested: 1.5 }]);
    teardownTaskTimer();
    __setOffline(false);

    await initTaskTimer(me, {});
    await flush(300);
    expect(secondsOf('A')).toBe(5420);
    expect(savedState().pending).toEqual({});
  });

  it('horas corrigidas no detalhe (mesmo offline) não são sobrescritas por uma gravação antiga do timer', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    __setOffline(true);
    toggle();                                   // pausa offline: 1:30:10 fica pendente
    await flush(300);

    await openTaskDetail(__doc('tasks', 'A'), vi.fn());
    choose($('#dd-hours'), '2');
    click($('#dd-save'));
    await flush(300);
    __setOffline(false);                        // volta a conexão: as duas gravações chegam, em ordem
    await flush(300);
    expect(__doc('tasks', 'A').hoursInvested).toBe(2);

    teardownTaskTimer();                        // reabre o app
    await initTaskTimer(me, {});
    await flush(300);
    expect(__doc('tasks', 'A').hoursInvested).toBe(2);
  });

  it('erro de permissão: avisa e não fica tentando para sempre', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    __failNext('updateDoc', 'permission-denied', 'Missing or insufficient permissions.');
    toggle();
    await flush(300);
    expect(lastToast()).toContain('Não foi possível salvar o tempo da tarefa: Missing or insufficient permissions.');
    expect(savedState().pending).toEqual({});
  });
});

describe('Timer — integração com o detalhe da tarefa', () => {
  async function openDetail(id) {
    await openTaskDetail(__doc('tasks', id), vi.fn());
  }

  it('o detalhe da tarefa ativa mostra as horas ao vivo', async () => {
    await startWith();
    toggle();
    await flush(36_000);
    await openDetail('A');
    await flush(1000);
    expect(text($('#dd-hours-live'))).toBe('⏱ Timer rodando — 1:30:37');
    expect($('#dd-hours').value).toBe('1.51');
  });

  it('horas digitadas no detalhe viram a nova base do timer', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    await openDetail('A');
    choose($('#dd-hours'), '4');
    click($('#dd-save'));
    await flush(300);
    expect(__doc('tasks', 'A').hoursInvested).toBe(4);

    await flush(60_000);
    toggle();
    await flush(300);
    expect(secondsOf('A')).toBe(4 * 3600 + 60);
  });

  it('salvar o detalhe sem mexer nas horas grava o valor do timer (e não o de quando abriu)', async () => {
    await startWith();
    toggle();
    await flush(10_000);
    await openDetail('A');
    await flush(120_000);
    choose($('#dd-priority'), 'Alta');
    click($('#dd-save'));
    await flush(300);
    expect(__doc('tasks', 'A').priority).toBe('Alta');
    expect(secondsOf('A')).toBe(5400 + 130);
  });

  it('fechar o detalhe da tarefa ativa grava o tempo', async () => {
    await startWith();
    toggle();
    await openDetail('A');
    await flush(30_000);
    click($('#dd-close'));
    await flush(1000);
    await flush(300);
    expect(secondsOf('A')).toBeGreaterThanOrEqual(5400 + 30);
    expect(secondsOf('A')).toBeLessThanOrEqual(5400 + 31);
  });
});

describe('Timer — ativar/desativar (Configurações)', () => {
  it('desativar pausa, grava e esconde; ativar mostra de novo', async () => {
    await startWith();
    toggle();
    await flush(12_000);

    await setTimerEnabled(me, false);
    expect(secondsOf('A')).toBe(5400 + 12);
    expect($('#task-timer').classList.contains('hidden')).toBe(true);
    expect(localStorage.getItem(`artrock:timer-enabled:${me.id}`)).toBe('0');

    await setTimerEnabled(me, true);
    expect($('#task-timer').classList.contains('hidden')).toBe(false);
    expect(items()).toEqual(['A', 'B']);
    expect(runningId()).toBeNull();
  });
});
