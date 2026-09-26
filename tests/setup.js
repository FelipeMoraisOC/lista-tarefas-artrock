// ── Preparação global dos testes ──────────────────────────
//
// 1. Bloqueia qualquer acesso à rede: se algum código tentar falar com a
//    internet (Firebase incluso), o teste quebra na hora.
// 2. Completa o jsdom com o que o app usa e ele não traz (PointerEvent…).
// 3. Depois de cada teste: limpa banco falso, sessão, storage, DOM, cache
//    do store e o timer — cada teste começa do zero.

import { afterEach, vi } from 'vitest';
import { __reset as resetFirestore } from 'firebase/firestore';
import { __resetAuth } from 'firebase/auth';
import { bust } from '../renderer/js/store.js';
import { teardownTaskTimer } from '../renderer/js/components/task-timer.js';

function networkBlocked(what) {
  return () => {
    throw new Error(
      `Teste tentou acessar a rede (${what}). Os testes rodam 100% local — ` +
      'use os fakes de tests/fakes em vez de serviços reais.');
  };
}

globalThis.fetch = networkBlocked('fetch');

if (typeof window !== 'undefined') {
  window.fetch = globalThis.fetch;
  window.XMLHttpRequest.prototype.open = networkBlocked('XMLHttpRequest');
  window.WebSocket = class { constructor() { networkBlocked('WebSocket')(); } };
  navigator.sendBeacon = networkBlocked('sendBeacon');

  // jsdom não implementa PointerEvent nem captura de ponteiro
  if (!window.PointerEvent) {
    window.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    };
    globalThis.PointerEvent = window.PointerEvent;
  }
  Element.prototype.setPointerCapture ??= function () {};
  Element.prototype.releasePointerCapture ??= function () {};
  window.requestAnimationFrame ??= cb => setTimeout(() => cb(Date.now()), 16);
}

afterEach(() => {
  vi.useRealTimers();
  resetFirestore();
  __resetAuth();
  bust();

  if (typeof window !== 'undefined') {       // testes do processo principal rodam sem DOM
    teardownTaskTimer();
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* sem storage */ }
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  }
});
