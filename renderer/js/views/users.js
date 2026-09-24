// ── Gerenciar Usuários (Admin) ────────────────────────────

import {
  getUsers, getSectors, getCurrentUser, isAdmin,
  createUser, updateUser,
} from '../store.js';
import { renderAccessDenied } from './admin.js';
import { openShell, closeModal, esc, icon } from './modals.js';
import { showToast } from '../utils.js';

function sectorName(id, sectors) {
  return sectors.find(s => s.id === id)?.name ?? id;
}

function sectorBadges(sectorIds, sectors) {
  if (!sectorIds?.length) return '<span class="text-muted text-small">—</span>';
  return sectorIds
    .map(id => `<span class="badge ${id === 'ALL' ? 'badge-cat' : 'badge-subtask'}">${esc(sectorName(id, sectors))}</span>`)
    .join(' ');
}

function sectorPicker(sectors, selected) {
  const sel = new Set(selected ?? []);
  const isAll = sel.has('ALL');

  return `
    <div class="adm-sector-grid" id="uf-sectors">
      ${sectors.map(s => `
        <label class="adm-sector-item${s.id === 'ALL' ? ' adm-sector-all' : ''}">
          <input type="checkbox" value="${s.id}"
            ${sel.has(s.id) ? 'checked' : ''}
            ${s.id !== 'ALL' && isAll ? 'disabled' : ''} />
          <span>${esc(s.name)}${s.id === 'ALL' ? ' <em>(todos os setores)</em>' : ''}</span>
        </label>`).join('')}
    </div>`;
}

function bindSectorPicker() {
  const wrap = document.getElementById('uf-sectors');
  if (!wrap) return;
  const all = wrap.querySelector('input[value="ALL"]');
  if (!all) return;

  all.addEventListener('change', () => {
    wrap.querySelectorAll('input:not([value="ALL"])').forEach(cb => {
      cb.disabled = all.checked;
      if (all.checked) cb.checked = false;
    });
  });
}

function readSectors() {
  return [...document.querySelectorAll('#uf-sectors input:checked')].map(cb => cb.value);
}

// ── Formulário: Novo Usuário ─────────────────────────────

function openUserForm({ model, sectors, onDone }) {
  const isEdit = !!model;

  openShell(`
    <div class="tc-topbar">
      <div class="tc-topbar-left">
        <span class="tc-section-icon">${icon('plus', 20)}</span>
        <span class="tc-section-title">${isEdit ? 'Editar Usuário' : 'Novo Usuário'}</span>
      </div>
      <div class="tc-topbar-right">
        <button class="tc-icon-btn" id="uf-close" title="Fechar">✕</button>
      </div>
    </div>

    <div class="tc-body tc-body-single">
      <div class="tc-main">
        <div class="tc-field adm-form-field">
          <div class="tc-meta-label req">UID (Firebase Auth)</div>
          <input type="text" class="tc-input" id="uf-uid" autocomplete="off"
            placeholder="Ex: abc123XYZ..." value="${esc(model?.id ?? '')}"
            ${isEdit ? 'disabled style="opacity:.6;cursor:not-allowed"' : ''} />
          <div class="tc-hint">O UID do usuário no Firebase Authentication.</div>
        </div>

        <div class="tc-field adm-form-field">
          <div class="tc-meta-label req">Email</div>
          <input type="email" class="tc-input" id="uf-email" autocomplete="off"
            placeholder="usuario@empresa.com" value="${esc(model?.email ?? '')}" />
        </div>

        <div class="tc-details-grid" style="margin-bottom:18px">
          <div class="tc-field adm-form-field">
            <div class="tc-meta-label">Nome</div>
            <input type="text" class="tc-input" id="uf-name" autocomplete="off"
              placeholder="Ex: João Silva" value="${esc(model?.name ?? '')}" />
          </div>
          <div class="tc-field adm-form-field">
            <div class="tc-meta-label req">Iniciais</div>
            <input type="text" class="tc-input" id="uf-initials" autocomplete="off"
              maxlength="3" placeholder="Ex: JS" value="${esc(model?.initials ?? '')}"
              style="text-transform:uppercase" />
          </div>
        </div>

        <div class="tc-field adm-form-field">
          <div class="tc-meta-label">Cargo / Função</div>
          <input type="text" class="tc-input" id="uf-role" autocomplete="off"
            placeholder="Ex: Desenvolvedor" value="${esc(model?.role ?? '')}" />
        </div>

        <div class="adm-form-field">
          <div class="tc-meta-label req">Setores</div>
          ${sectorPicker(sectors, model?.sectorIds ?? ['ALL'])}
          <div class="tc-hint">Define quais setores o usuário pertence.</div>
        </div>
      </div>
    </div>

    <div class="tc-footer">
      <button class="tc-btn" id="uf-cancel">Cancelar</button>
      <button class="tc-btn tc-btn-primary" id="uf-save">${icon('save', 15)} ${isEdit ? 'Salvar' : 'Criar Usuário'}</button>
    </div>
  `, 'tc-create');

  bindSectorPicker();

  const firstInput = document.getElementById(isEdit ? 'uf-email' : 'uf-uid');
  firstInput.focus();

  document.getElementById('uf-close').onclick = closeModal;
  document.getElementById('uf-cancel').onclick = closeModal;

  document.getElementById('uf-save').onclick = async () => {
    const btn = document.getElementById('uf-save');
    const uid = document.getElementById('uf-uid').value.trim();
    const email = document.getElementById('uf-email').value.trim();
    const name = document.getElementById('uf-name').value.trim();
    const initials = document.getElementById('uf-initials').value.trim();
    const role = document.getElementById('uf-role').value.trim();
    const sectorIds = readSectors();

    btn.disabled = true;
    try {
      if (isEdit) {
        await updateUser(model.id, { email, name: name || email, initials: initials.toUpperCase(), role: role || 'Colaborador', sectorIds });
      } else {
        await createUser({ uid, email, name, initials, role, sectorIds });
      }
      closeModal();
      showToast(isEdit ? 'Usuário atualizado!' : 'Usuário criado!', 'success');
      await onDone();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  };
}

// ── View ─────────────────────────────────────────────────

export async function initUsers(container) {
  const currentUser = await getCurrentUser();
  if (!await isAdmin(currentUser)) { renderAccessDenied(container); return; }

  let search = '';
  let users = [];
  let sectors = [];

  async function reload() {
    [users, sectors] = await Promise.all([getUsers(), getSectors()]);
  }

  function renderTable() {
    const term = search.toLowerCase().trim();
    const filtered = term
      ? users.filter(u => u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
      : users;

    const body = document.getElementById('users-body');
    body.innerHTML = `
      <table class="adm-table">
        <thead>
          <tr>
            <th>Iniciais</th>
            <th>Nome</th>
            <th>Email</th>
            <th>Cargo</th>
            <th>Setores</th>
            <th class="adm-actions-col"></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length ? filtered.map(u => `
            <tr data-id="${u.id}">
              <td><span class="user-avatar-sm">${esc(u.initials ?? '?')}</span></td>
              <td><span class="adm-name">${esc(u.name)}</span></td>
              <td class="text-muted text-small">${esc(u.email ?? '—')}</td>
              <td class="text-small">${esc(u.role ?? '—')}</td>
              <td>${sectorBadges(u.sectorIds, sectors)}</td>
              <td class="adm-actions-col">
                <div class="adm-row-actions">
                  <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${u.id}" title="Editar">
                    ${icon('edit', 14)} Editar
                  </button>
                </div>
              </td>
            </tr>`).join('')
          : `<tr><td colspan="6"><div class="adm-empty">Nenhum usuário encontrado.</div></td></tr>`}
        </tbody>
      </table>`;

    body.querySelectorAll('[data-act="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = users.find(x => x.id === btn.dataset.id);
        if (u) openUserForm({ model: u, sectors, onDone: refresh });
      });
    });
  }

  async function refresh() {
    await reload();
    document.getElementById('cnt-users').textContent = users.length;
    renderTable();
  }

  await reload();

  container.innerHTML = `
    <div class="tasks-toolbar adm-toolbar">
      <div class="status-tabs">
        <button class="status-tab active" disabled>
          Usuários <span class="badge badge-count" id="cnt-users">${users.length}</span>
        </button>
      </div>

      <div class="search-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" class="search-input" id="users-search" placeholder="Buscar por nome ou email..." />
        </div>
        <button class="btn btn-primary btn-sm" id="users-new">
          ${icon('plus', 15)} Novo Usuário
        </button>
      </div>
    </div>

    <div class="adm-hint">
      Primeiro crie o usuário no Firebase Authentication (email + senha), depois registre-o aqui com o UID gerado.
    </div>

    <div id="users-body"></div>
  `;

  renderTable();

  document.getElementById('users-search').addEventListener('input', e => {
    search = e.target.value;
    renderTable();
  });

  document.getElementById('users-new').addEventListener('click', () => {
    openUserForm({ sectors, onDone: refresh });
  });
}
