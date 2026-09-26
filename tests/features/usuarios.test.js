// Funcionalidade: Gerenciar Usuários (Admin).

import { describe, it, expect } from 'vitest';
import { __doc } from 'firebase/firestore';
import { initUsers } from '../../renderer/js/views/users.js';
import { seedWorld, signInAs, USERS } from '../helpers/world.js';
import { mountAppShell, $, $$, click, typeInto, check, settle, text, modal, lastToast } from '../helpers/dom.js';

let main;

async function openAs(user) {
  seedWorld();
  signInAs(user);
  main = mountAppShell();
  await initUsers(main);
}

const names = () => $$('#users-body .adm-name', main).map(text);

describe('Gerenciar Usuários', () => {
  it('quem não é Admin vê "Acesso restrito"', async () => {
    await openAs(USERS.dev);
    expect(text($('.empty-title', main))).toBe('Acesso restrito');
  });

  it('lista os usuários e busca por nome ou email', async () => {
    await openAs(USERS.admin);
    expect(text($('#cnt-users', main))).toBe('5');
    expect(names()).toHaveLength(5);

    typeInto($('#users-search', main), 'carla');
    expect(names()).toEqual(['Carla Vendas']);

    typeInto($('#users-search', main), 'bruno@artrock');
    expect(names()).toEqual(['Bruno TI']);
  });

  it('cria usuário pelo formulário (iniciais em maiúsculas)', async () => {
    await openAs(USERS.admin);
    click($('#users-new', main));
    typeInto($('#uf-uid'), 'uid-felipe');
    typeInto($('#uf-email'), 'felipe@artrock.test');
    typeInto($('#uf-name'), 'Felipe');
    typeInto($('#uf-initials'), 'fm');
    check($('#uf-sectors input[value="s1"]'));
    click($('#uf-save'));
    await settle();

    expect(__doc('users', 'uid-felipe')).toMatchObject({ name: 'Felipe', initials: 'FM', role: 'Colaborador' });
    expect(lastToast()).toContain('Usuário criado!');
    expect(text($('#cnt-users', main))).toBe('6');
  });

  it('cadastro sem UID mostra o erro e não fecha o formulário', async () => {
    await openAs(USERS.admin);
    click($('#users-new', main));
    typeInto($('#uf-email'), 'x@artrock.test');
    typeInto($('#uf-initials'), 'XX');
    click($('#uf-save'));
    await settle();
    expect(lastToast()).toContain('UID é obrigatório.');
    expect(modal()).not.toBeNull();
  });

  it('editar: o UID fica travado e as mudanças são gravadas', async () => {
    await openAs(USERS.admin);
    click($(`#users-body [data-act="edit"][data-id="${USERS.sales.id}"]`, main));
    expect($('#uf-uid').disabled).toBe(true);
    typeInto($('#uf-role'), 'Gerente de Contas');
    click($('#uf-save'));
    await settle();
    expect(__doc('users', USERS.sales.id).role).toBe('Gerente de Contas');
    expect(lastToast()).toContain('Usuário atualizado!');
  });

  it('marcar TODOS desmarca e trava os outros setores', async () => {
    await openAs(USERS.admin);
    click($(`#users-body [data-act="edit"][data-id="${USERS.dev.id}"]`, main));
    const s1 = $('#uf-sectors input[value="s1"]');
    expect(s1.checked).toBe(true);
    check($('#uf-sectors input[value="ALL"]'));
    expect(s1.checked).toBe(false);
    expect(s1.disabled).toBe(true);
  });
});
