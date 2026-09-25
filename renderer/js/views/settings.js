// ── Configurações — perfil, timer e sessão ────────────────
//
// Aberta pelo usuário no topo do menu lateral.

import { getCurrentUser, getSectors } from '../store.js';
import { logout } from '../auth.js';
import {
  isTimerEnabled, setTimerEnabled, stopTaskTimer, flushTaskTimer,
} from '../components/task-timer.js';
import { esc } from './modals.js';
import { showToast } from '../utils.js';

export async function initSettings(container) {
  const [user, sectors] = await Promise.all([getCurrentUser(), getSectors()]);
  const sectorNames = (user.sectorIds ?? [])
    .map(id => sectors.find(s => s.id === id)?.name ?? id)
    .join(', ');

  container.innerHTML = `
    <div class="set-wrap">
      <section class="set-card set-profile">
        <span class="user-avatar set-avatar">${esc(user.initials)}</span>
        <div class="set-profile-info">
          <div class="set-name">${esc(user.name)}</div>
          <div class="set-meta">${esc(user.role ?? '')}${user.email ? ` · ${esc(user.email)}` : ''}</div>
          <div class="set-meta">Setores: ${esc(sectorNames || '—')}</div>
        </div>
      </section>

      <section class="set-card">
        <div class="set-card-title">Timer</div>
        <label class="set-row" for="set-timer">
          <div class="set-row-text">
            <div class="set-row-title">Timer das tarefas em andamento</div>
            <div class="set-row-desc">Mostra no menu lateral o timer que registra as Horas Investidas. Ao desativar, o tempo em andamento é salvo e o timer é pausado.</div>
          </div>
          <input type="checkbox" class="set-switch" id="set-timer" ${isTimerEnabled(user.id) ? 'checked' : ''} />
        </label>
      </section>

      <section class="set-card">
        <div class="set-card-title">Aplicação</div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Recarregar aplicação</div>
            <div class="set-row-desc">Busca todos os dados novamente. O timer continua de onde parou.</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="set-reload">Recarregar</button>
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Sair da conta</div>
            <div class="set-row-desc">O tempo do timer é salvo antes de sair.</div>
          </div>
          <button type="button" class="btn btn-danger btn-sm" id="set-logout">Sair</button>
        </div>
      </section>
    </div>`;

  const timerSwitch = document.getElementById('set-timer');
  timerSwitch.addEventListener('change', async () => {
    const enabled = timerSwitch.checked;
    timerSwitch.disabled = true;
    try {
      await setTimerEnabled(user, enabled);
      showToast(enabled ? 'Timer ativado.' : 'Timer desativado. O tempo em andamento foi salvo.', 'success');
    } catch (err) {
      showToast(`Erro ao ${enabled ? 'ativar' : 'desativar'} o timer: ${esc(err.message)}`, 'error');
      timerSwitch.checked = !enabled;
    } finally {
      timerSwitch.disabled = false;
    }
  });

  document.getElementById('set-reload').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await flushTaskTimer();   // grava o tempo atual antes de recarregar
    location.reload();
  });

  document.getElementById('set-logout').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await stopTaskTimer();    // pausa e grava o tempo antes de perder a sessão
    history.replaceState(null, '', '#dashboard');   // próximo login abre no Dashboard
    await logout();           // onAuthChange cuida de mostrar a tela de login
  });
}
