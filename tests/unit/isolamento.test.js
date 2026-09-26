// Garante a regra de ouro dos testes: nada sai da máquina.

import { describe, it, expect } from 'vitest';
import * as firestore from 'firebase/firestore';
import * as auth from 'firebase/auth';
import * as app from 'firebase/app';
import { db, auth as appAuth } from '../../renderer/js/firebase.js';

describe('Isolamento dos testes (sem Firebase real, sem rede)', () => {
  it('usa o Firestore falso em memória no lugar do SDK', () => {
    expect(firestore.__reset).toBeTypeOf('function');
    expect(db).toEqual({ __fake: 'firestore' });
  });

  it('usa o Auth falso no lugar do SDK', () => {
    expect(auth.__resetAuth).toBeTypeOf('function');
    expect(appAuth.currentUser).toBeNull();
  });

  it('o app é "inicializado" sem conectar em nada', () => {
    expect(app.initializeApp({ projectId: 'x' })).toEqual({ name: '[DEFAULT]', options: { projectId: 'x' } });
  });

  it('bloqueia fetch', () => {
    expect(() => fetch('https://firestore.googleapis.com')).toThrow(/rede/);
  });

  it('bloqueia XMLHttpRequest e WebSocket', () => {
    const xhr = new XMLHttpRequest();
    expect(() => xhr.open('GET', 'https://example.com')).toThrow(/rede/);
    expect(() => new WebSocket('wss://example.com')).toThrow(/rede/);
  });
});
