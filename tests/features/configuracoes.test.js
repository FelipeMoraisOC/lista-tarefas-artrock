// Funcionalidade: Configurações (perfil, timer, recarregar, sair).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __doc } from 'firebase/firestore';
import { authCalls } from 'firebase/auth';
import { initSettings } from '../../renderer/js/views/settings.js';
import { initTaskTimer } from '../../renderer/js/components/task-timer.js';
import { getFirebaseUser } from '../../renderer/js/auth.js';
import { seedWorld, signInAs, makeTask, USERS } from '../helpers/world.js';
import { mountAppShell, $, click, check, text, lastToast } from '../helpers/dom.js';

const me = USERS.dev;
let main, reload;

async function open({ timerRunningFor = 0 } = {}) {
  seedWorld({ tasks: [makeTask({ id: 'A', status: 'Em Andamento', hoursInvested: 1 })] });
  signInAs(me);
  main = mountAppShell();
  await initTaskTimer(me, {});
  if (timerRunningFor) {
    click($('#tt-toggle'));
    await vi.advanceTimersByTimeAsync(timerRunningFor);
  }
  reload = vi.fn();
  await initSettings(main, { reload });
}

const secondsOf = id => Math.round(__doc('tasks', id).hoursInvested * 3600);
const flush = () => vi.advanceTimersByTimeAsync(300);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z') });
});

describe('Configurações', () => {
  it('mostra meu perfil: nome, cargo, email e setores', async () => {
    await open();
    expect(text($('.set-name', main))).toBe('Ana Dev');
    expect(text(main)).toContain('Desenvolvedora · ana@artrock.test');
    expect(text(main)).toContain('Setores: T.I');
  });

  it('desligar o timer salva o tempo, pausa e esconde o painel; religar mostra de novo', async () => {
    await open({ timerRunningFor: 20_000 });
    const sw = $('#set-timer', main);
    expect(sw.checked).toBe(true);

    check(sw, false);
    await flush();
    expect(secondsOf('A')).toBe(3600 + 20);
    expect($('#task-timer').classList.contains('hidden')).toBe(true);
    expect(lastToast()).toContain('Timer desativado. O tempo em andamento foi salvo.');

    check(sw, true);
    await flush();
    expect($('#task-timer').classList.contains('hidden')).toBe(false);
    expect(lastToast()).toContain('Timer ativado.');
  });

  it('a preferência do timer é lembrada ao voltar na tela', async () => {
    await open();
    check($('#set-timer', main), false);
    await flush();
    await initSettings(main, { reload });
    expect($('#set-timer', main).checked).toBe(false);
  });

  it('"Recarregar" salva o tempo do timer antes de recarregar', async () => {
    await open({ timerRunningFor: 30_000 });
    click($('#set-reload', main));
    await flush();
    expect(secondsOf('A')).toBe(3600 + 30);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('"Sair" salva o timer, encerra a sessão e o próximo login abre no Dashboard', async () => {
    await open({ timerRunningFor: 10_000 });
    history.replaceState(null, '', '#settings');
    click($('#set-logout', main));
    await flush();
    expect(secondsOf('A')).toBe(3600 + 10);
    expect(authCalls.signOut).toBe(1);
    expect(getFirebaseUser()).toBeNull();
    expect(location.hash).toBe('#dashboard');
  });
});
