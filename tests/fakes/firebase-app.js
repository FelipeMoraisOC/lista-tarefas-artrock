// Substituto de `firebase/app` nos testes — não conecta em nada.

export function initializeApp(options = {}) {
  return { name: '[DEFAULT]', options };
}
