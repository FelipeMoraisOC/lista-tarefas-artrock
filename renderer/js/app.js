// ── App entry point — router + auth + global init ─────────

import { initDashboard } from './views/dashboard.js';
import { initTasks }     from './views/tasks.js';
import { initAdmin, renderAccessDenied } from './views/admin.js';
import { initUsers } from './views/users.js';
import { initDelegated } from './views/delegated.js';
import { initBacklog } from './views/backlog.js';
import { initSettings } from './views/settings.js';
import { openCreateTask } from './views/modals.js';
import { initTaskTimer, teardownTaskTimer, flushTaskTimer } from './components/task-timer.js';
import { getCurrentUser, isAdmin, bust } from './store.js';
import { onAuthChange, loginWithEmail, resetPassword } from './auth.js';
import { showToast } from './utils.js';

// ── Routes ────────────────────────────────────────────────

const ROUTES = {
  dashboard: { fn: initDashboard, title: 'Dashboard' },
  tasks:     { fn: initTasks,     title: 'Minhas Tarefas' },
  admin:     { fn: initAdmin,     title: 'Administração', adminOnly: true },
  users:     { fn: initUsers,     title: 'Gerenciar Usuários', adminOnly: true },
  delegated: { fn: initDelegated, title: 'Tarefas Delegadas' },
  backlog:   { fn: initBacklog,   title: 'Backlog' },
  settings:  { fn: initSettings,  title: 'Configurações' },
};

// Mostra o menu Administração apenas para o setor Admin e esconde
// "Nova Tarefa" nas páginas que não usam o fluxo padrão
// (o Backlog tem o próprio botão, com escolha de setor).
function applyAccessUI(admin, page) {
  document.getElementById('nav-admin').classList.toggle('hidden', !admin);
  document.getElementById('nav-users').classList.toggle('hidden', !admin);
  document.getElementById('btn-new-task').classList.toggle('hidden',
    ['admin', 'users', 'delegated', 'backlog', 'settings'].includes(page));
}

async function navigate(raw) {
  const page  = (raw || 'dashboard').replace('#', '');
  const route = ROUTES[page] ?? ROUTES.dashboard;

  // Title + active nav
  document.getElementById('page-title').textContent = route.title;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );

  // Spinner
  const content = document.getElementById('main-content');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const admin = await isAdmin(await getCurrentUser());
    applyAccessUI(admin, page);

    if (route.adminOnly && !admin) { renderAccessDenied(content); return; }

    await route.fn(content);
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar</div>
        <div class="empty-desc">${err.message}</div>
      </div>`;
    console.error(err);
  }
}

function currentPage() {
  return (location.hash || '#dashboard').replace('#', '') || 'dashboard';
}

// ── Timer das tarefas em andamento (menu lateral) ─────────

async function startTaskTimer() {
  const user = await getCurrentUser();
  if (!user) return;
  // Quando o timer conclui uma tarefa (ou salva pelo detalhe), recarrega a tela atual
  initTaskTimer(user, { onDataChanged: () => navigate(currentPage()) })
    .catch(err => console.error('[timer] Falha ao iniciar', err));
}

// Ao fechar a janela, o main process espera o timer gravar (ver preload.js)
window.appLifecycle?.onBeforeClose(() => flushTaskTimer());

// ── Usuário no topo do menu (abre Configurações) ──────────

async function initUserInfo() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  document.getElementById('sidebar-avatar').textContent   = currentUser.initials;
  document.getElementById('sidebar-username').textContent = currentUser.name;
  document.getElementById('sidebar-role').textContent     = currentUser.role;
}

// ── Login screen ──────────────────────────────────────────

function initLoginScreen() {
  const form     = document.getElementById('login-form');
  const emailIn  = document.getElementById('login-email');
  const passIn   = document.getElementById('login-password');
  const errEl    = document.getElementById('login-error');
  const submit   = document.getElementById('login-submit');
  const forgot   = document.getElementById('login-forgot');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
  function hideError() {
    errEl.classList.add('hidden');
  }

  const AUTH_ERRORS = {
    'auth/invalid-email':        'Email inválido.',
    'auth/user-disabled':        'Conta desativada. Contate o administrador.',
    'auth/user-not-found':       'Usuário não encontrado.',
    'auth/wrong-password':       'Senha incorreta.',
    'auth/invalid-credential':   'Email ou senha incorretos.',
    'auth/too-many-requests':    'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideError();
    submit.disabled = true;
    submit.textContent = 'Entrando...';

    try {
      await loginWithEmail(emailIn.value.trim(), passIn.value);
      // onAuthChange cuida de mostrar o app
    } catch (err) {
      showError(AUTH_ERRORS[err.code] ?? `Erro: ${err.message}`);
      submit.disabled = false;
      submit.textContent = 'Entrar';
    }
  });

  forgot.addEventListener('click', async () => {
    const email = emailIn.value.trim();
    if (!email) { showError('Preencha o campo de email para redefinir a senha.'); return; }
    try {
      await resetPassword(email);
      hideError();
      showToast('Email de redefinição enviado!', 'info');
    } catch (err) {
      showError(AUTH_ERRORS[err.code] ?? `Erro: ${err.message}`);
    }
  });
}

// ── Boot ──────────────────────────────────────────────────

let _booted = false;

async function boot() {
  if (_booted) {
    // Re-autenticação: limpar cache e re-renderizar
    bust();
    await initUserInfo();
    navigate(currentPage());
    startTaskTimer();
    return;
  }
  _booted = true;

  await initUserInfo();
  startTaskTimer();

  // "Nova Tarefa" button
  document.getElementById('btn-new-task').addEventListener('click', () => {
    openCreateTask(() => navigate(currentPage()));
  });

  // Hash-based routing
  window.addEventListener('hashchange', () => navigate(currentPage()));

  // Initial route
  navigate(currentPage());
}

// ── Auth state listener (controla login ↔ app) ────────────

initLoginScreen();

onAuthChange(async firebaseUser => {
  const loginScreen = document.getElementById('login-screen');
  const app         = document.getElementById('app');

  if (firebaseUser) {
    // Autenticado → mostrar o app
    loginScreen.style.display = 'none';
    app.style.display = 'flex';
    try {
      await boot();
    } catch (err) {
      console.error('Boot failed:', err);
      document.getElementById('main-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💥</div>
          <div class="empty-title">Falha ao iniciar o aplicativo</div>
          <div class="empty-desc">${err.message}</div>
        </div>`;
    }
  } else {
    // Não autenticado → mostrar login
    loginScreen.style.display = 'flex';
    app.style.display = 'none';
    const loginSubmit = document.getElementById('login-submit');
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Entrar';
    _booted = false;
    teardownTaskTimer();
    bust(); // limpar cache de dados do usuário anterior
  }
});
