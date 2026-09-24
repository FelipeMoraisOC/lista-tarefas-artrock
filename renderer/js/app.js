// ── App entry point — router + auth + global init ─────────

import { initDashboard } from './views/dashboard.js';
import { initTasks }     from './views/tasks.js';
import { initAdmin, renderAccessDenied } from './views/admin.js';
import { initUsers } from './views/users.js';
import { openCreateTask } from './views/modals.js';
import { getUsers, setCurrentUser, getCurrentUser, isAdmin, bust } from './store.js';
import { onAuthChange, loginWithEmail, logout, resetPassword } from './auth.js';
import { showToast } from './utils.js';

// ── Routes ────────────────────────────────────────────────

const ROUTES = {
  dashboard: { fn: initDashboard, title: 'Dashboard' },
  tasks:     { fn: initTasks,     title: 'Minhas Tarefas' },
  admin:     { fn: initAdmin,     title: 'Administração', adminOnly: true },
  users:     { fn: initUsers,     title: 'Gerenciar Usuários', adminOnly: true },
};

// Mostra o menu Administração apenas para o setor Admin e esconde
// "Nova Tarefa" na própria página de Administração.
function applyAccessUI(admin, page) {
  document.getElementById('nav-admin').classList.toggle('hidden', !admin);
  document.getElementById('nav-users').classList.toggle('hidden', !admin);
  document.getElementById('btn-new-task').classList.toggle('hidden', page === 'admin' || page === 'users');
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

// ── User info + user-switcher (dev) ───────────────────────

async function initUserInfo() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const avatar   = document.getElementById('sidebar-avatar');
  const username = document.getElementById('sidebar-username');
  const role     = document.getElementById('sidebar-role');

  function updateUI(u) {
    avatar.textContent   = u.initials;
    username.textContent = u.name;
    role.textContent     = u.role;
  }

  updateUI(currentUser);

  // User-switcher (apenas dev — o wrapper tem classe dev-only)
  const sel = document.getElementById('user-switcher');
  if (sel) {
    const users = await getUsers();
    sel.innerHTML = users.map(u =>
      `<option value="${u.id}">${u.name}</option>`
    ).join('');
    sel.value = currentUser.id;

    sel.addEventListener('change', async e => {
      await setCurrentUser(e.target.value);
      bust(); // limpar cache para re-ler dados do novo usuário
      const u = users.find(x => x.id === e.target.value);
      if (u) updateUI(u);
      navigate(currentPage());
    });
  }
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
    return;
  }
  _booted = true;

  await initUserInfo();

  // "Nova Tarefa" button
  document.getElementById('btn-new-task').addEventListener('click', () => {
    openCreateTask(() => navigate(currentPage()));
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    // onAuthChange cuida de esconder o app e mostrar login
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
    bust(); // limpar cache de dados do usuário anterior
  }
});
