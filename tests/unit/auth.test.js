// Autenticação (auth.js) — sobre o Firebase Auth falso.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __addAccount, __failNextAuth, authCalls } from 'firebase/auth';
import {
  loginWithEmail, logout, onAuthChange, getFirebaseUser, resetPassword,
} from '../../renderer/js/auth.js';

beforeEach(() => {
  __addAccount({ uid: 'u-dev', email: 'ana@artrock.test', password: 'segredo123' });
});

describe('Autenticação', () => {
  it('login com email e senha corretos abre a sessão', async () => {
    const { user } = await loginWithEmail('ana@artrock.test', 'segredo123');
    expect(user.uid).toBe('u-dev');
    expect(getFirebaseUser()).toMatchObject({ uid: 'u-dev' });
  });

  it('senha errada é recusada com o código de erro do Firebase', async () => {
    await expect(loginWithEmail('ana@artrock.test', 'errada'))
      .rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(getFirebaseUser()).toBeNull();
  });

  it('erros do serviço chegam para a tela tratar (ex.: muitas tentativas)', async () => {
    __failNextAuth('auth/too-many-requests');
    await expect(loginWithEmail('ana@artrock.test', 'segredo123'))
      .rejects.toMatchObject({ code: 'auth/too-many-requests' });
  });

  it('onAuthChange avisa o estado inicial, o login e o logout', async () => {
    const cb = vi.fn();
    const unsubscribe = onAuthChange(cb);
    await Promise.resolve();
    expect(cb).toHaveBeenLastCalledWith(null);

    await loginWithEmail('ana@artrock.test', 'segredo123');
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ uid: 'u-dev' }));

    await logout();
    expect(cb).toHaveBeenLastCalledWith(null);
    expect(authCalls.signOut).toBe(1);

    unsubscribe();
    await loginWithEmail('ana@artrock.test', 'segredo123');
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('resetPassword envia o email de redefinição', async () => {
    await resetPassword('ana@artrock.test');
    expect(authCalls.reset).toEqual(['ana@artrock.test']);
  });
});
