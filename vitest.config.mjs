// ── Vitest — testes automatizados (100% locais) ───────────
//
// Os pacotes `firebase/*` são trocados por versões falsas, em memória
// (tests/fakes). Nenhum teste fala com o Firebase de verdade — e o
// tests/setup.js ainda bloqueia qualquer acesso à rede.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const fake = file => fileURLToPath(new URL(`./tests/fakes/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^firebase\/app$/,       replacement: fake('firebase-app.js') },
      { find: /^firebase\/auth$/,      replacement: fake('firebase-auth.js') },
      { find: /^firebase\/firestore$/, replacement: fake('firebase-firestore.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['renderer/js/**/*.js', 'main.js', 'preload.js', 'updater.js'],
      exclude: ['renderer/js/firebase.js'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
