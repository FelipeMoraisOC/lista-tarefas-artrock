// Funcionalidade: Autenticação (tela de login), navegação e controle de acesso.
//
// Cada teste carrega uma cópia nova do app (app.js registra tudo ao ser
// importado), sobre o HTML real do renderer/index.html.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountAppShell, $, $$, click, typeInto, settle, text, lastToast } from '../helpers/dom.js';

let ctx = null;
let windowListeners = [];

async function bootApp({ signedInAs = null, withAccount = true } = {}) {
  vi.resetModules();
  const fakeAuth = await import('firebase/auth');
  const fakeDb   = await import('firebase/firestore');
  const world    = await import('../helpers/world.js');
  const timer    = await import('../../renderer/js/components/task-timer.js');

  world.seedWorld({ tasks: [world.makeTask({ id: 'A', name: 'Minha tarefa', status: 'Em Andamento', hoursInvested: 1 })] });
  if (withAccount) fakeAuth.__addAccount({ uid: 'u-dev', email: 'ana@artrock.test', password: 'segredo' });
  if (signedInAs) fakeAuth.__setSignedIn(signedInAs);

  // guarda os listeners que o app registrar no window, para removê-los no fim
  const add = window.addEventListener;
  vi.spyOn(window, 'addEventListener').mockImplementation(function (type, fn, opts) {
    windowListeners.push([type, fn, opts]);
    return add.call(this, type, fn, opts);
  });

  mountAppShell();
  window.appLifecycle = { onBeforeClose: vi.fn() };
  await import('../../renderer/js/app.js');
  await settle();

  ctx = { fakeAuth, fakeDb, world, timer };
  return ctx;
}

async function goTo(page) {
  location.hash = `#${page}`;
  await settle();
}

async function login(email, password) {
  typeInto($('#login-email'), email);
  typeInto($('#login-password'), password);
  $('#login-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

const visible = sel => !$(sel).classList.contains('hidden');

afterEach(() => {
  ctx?.timer.teardownTaskTimer();
  windowListeners.forEach(([type, fn, opts]) => window.removeEventListener(type, fn, opts));
  windowListeners = [];
  delete window.appLifecycle;
  ctx = null;
});

describe('App — tela de login', () => {
  it('sem sessão, mostra o login e esconde o app', async () => {
    await bootApp();
    expect($('#login-screen').style.display).toBe('flex');
    expect($('#app').style.display).toBe('none');
  });

  it('email ou senha errados: mensagem clara e botão liberado para tentar de novo', async () => {
    await bootApp();
    await login('ana@artrock.test', 'errada');
    expect(text($('#login-error'))).toBe('Email ou senha incorretos.');
    expect($('#login-error').classList.contains('hidden')).toBe(false);
    expect($('#login-submit').disabled).toBe(false);
    expect(text($('#login-submit'))).toBe('Entrar');
  });

  it.each([
    ['auth/too-many-requests', 'Muitas tentativas. Tente novamente mais tarde.'],
    ['auth/network-request-failed', 'Sem conexão. Verifique sua internet.'],
    ['auth/user-disabled', 'Conta desativada. Contate o administrador.'],
  ])('erro %s vira mensagem em português', async (code, message) => {
    const { fakeAuth } = await bootApp();
    fakeAuth.__failNextAuth(code);
    await login('ana@artrock.test', 'segredo');
    expect(text($('#login-error'))).toBe(message);
  });

  it('login certo abre o app no Dashboard, com meu nome no topo do menu', async () => {
    await bootApp();
    await login('ana@artrock.test', 'segredo');
    expect($('#login-screen').style.display).toBe('none');
    expect($('#app').style.display).toBe('flex');
    expect(text($('#sidebar-username'))).toBe('Ana Dev');
    expect(text($('#sidebar-role'))).toBe('Desenvolvedora');
    expect(text($('#page-title'))).toBe('Dashboard');
    expect($$('.stat-card')).toHaveLength(3);
    expect(visible('#task-timer')).toBe(true);
  });

  it('"Esqueci minha senha" pede o email e depois envia a redefinição', async () => {
    const { fakeAuth } = await bootApp();
    click($('#login-forgot'));
    await settle();
    expect(text($('#login-error'))).toBe('Preencha o campo de email para redefinir a senha.');

    typeInto($('#login-email'), 'ana@artrock.test');
    click($('#login-forgot'));
    await settle();
    expect(fakeAuth.authCalls.reset).toEqual(['ana@artrock.test']);
    expect(lastToast()).toContain('Email de redefinição enviado!');
  });
});

describe('App — navegação e acesso', () => {
  it('trocar o endereço troca a tela, o título e o item ativo do menu', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    await goTo('tasks');
    expect(text($('#page-title'))).toBe('Minhas Tarefas');
    expect($('.nav-item.active').dataset.page).toBe('tasks');
    expect($('#tasks-grid')).not.toBeNull();

    await goTo('backlog');
    expect(text($('#page-title'))).toBe('Backlog');
  });

  it('endereço desconhecido cai no Dashboard', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    await goTo('nao-existe');
    expect(text($('#page-title'))).toBe('Dashboard');
  });

  it('usuário comum: menus de Admin escondidos e acesso direto bloqueado', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    expect(visible('#nav-admin')).toBe(false);
    expect(visible('#nav-users')).toBe(false);
    await goTo('admin');
    expect(text($('#main-content .empty-title'))).toBe('Acesso restrito');
    await goTo('users');
    expect(text($('#main-content .empty-title'))).toBe('Acesso restrito');
  });

  it('Admin vê e acessa a Administração', async () => {
    await bootApp({ signedInAs: 'u-admin' });
    expect(visible('#nav-admin')).toBe(true);
    expect(visible('#nav-users')).toBe(true);
    await goTo('admin');
    expect($('#adm-body')).not.toBeNull();
  });

  it('"Nova Tarefa" do topo só aparece nas telas do fluxo padrão', async () => {
    await bootApp({ signedInAs: 'u-admin' });
    const expected = {
      dashboard: true, tasks: true,
      delegated: false, backlog: false, settings: false, admin: false, users: false,
    };
    for (const [page, shown] of Object.entries(expected)) {
      await goTo(page);
      expect(visible('#btn-new-task'), page).toBe(shown);
    }
  });

  it('o primeiro item do menu é o usuário e leva às Configurações', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    const first = $('.sidebar-nav .nav-item');
    expect(first.getAttribute('href')).toBe('#settings');
    expect(text(first)).toContain('Ana Dev');
    await goTo('settings');
    expect(text($('#page-title'))).toBe('Configurações');
    expect(first.classList.contains('active')).toBe(true);
  });
});

describe('App — criar tarefa pelo topo e falhas', () => {
  it('"Nova Tarefa" do topo cria a tarefa e atualiza a tela atual', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    await goTo('tasks');
    click($('#btn-new-task'));
    await settle();
    typeInto($('#fc-name'), 'Criada pelo topo');
    $('#fc-at').value = 'at-dev';
    $('#fc-at').dispatchEvent(new Event('change', { bubbles: true }));
    $('#fc-cat').value = 'c-bug';
    $('#fc-deadline').value = '2026-10-30';
    click($('#mc-save'));
    await settle();
    expect($$('#tasks-grid .task-card-name').map(text)).toContain('Criada pelo topo');
  });

  it('se o perfil não carregar ao entrar, mostra um erro em vez de tela em branco', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    const fakeDb = await import('firebase/firestore');
    fakeDb.__failNext('getDoc', 'unavailable', 'Serviço indisponível');
    const fakeAuth = await import('firebase/auth');
    fakeAuth.__setSignedIn('u-dev');
    const timer = await import('../../renderer/js/components/task-timer.js');
    ctx = { timer };
    mountAppShell();
    await import('../../renderer/js/app.js');
    await settle();
    expect(text($('#main-content'))).toContain('Falha ao iniciar o aplicativo');
    expect(text($('#main-content'))).toContain('Serviço indisponível');
  });
});

describe('App — sessão e fechamento', () => {
  it('ao fechar a janela, o timer é salvo antes', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-26T12:00:00Z') });
    const { fakeDb } = await bootApp({ signedInAs: 'u-dev' });
    const onBeforeClose = window.appLifecycle.onBeforeClose.mock.calls[0][0];

    click($('#tt-toggle'));
    vi.setSystemTime(Date.now() + 60_000);
    await onBeforeClose();

    expect(Math.round(fakeDb.__doc('tasks', 'A').hoursInvested * 3600)).toBe(3600 + 60);
  });

  it('sair da conta volta para o login e desliga o timer', async () => {
    await bootApp({ signedInAs: 'u-dev' });
    await goTo('settings');
    click($('#set-logout'));
    await settle();
    expect($('#login-screen').style.display).toBe('flex');
    expect($('#app').style.display).toBe('none');
    expect(visible('#task-timer')).toBe(false);
  });
});
