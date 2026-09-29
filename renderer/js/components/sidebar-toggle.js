// ── Menu lateral compacto (janela estreita / zoom alto) ──
// Abaixo de 800px de largura útil o CSS mostra o menu como uma coluna de ícones
// e exibe o botão #btn-menu, que abre o menu completo por cima do conteúdo.
// Aqui só o comportamento: abrir/fechar, estado anunciado, foco e Esc.

export function initSidebarToggle() {
  const app     = document.getElementById('app');
  const btn     = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar');
  if (!app || !btn || !sidebar || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  const isOpen = () => app.classList.contains('sidebar-open');

  function set(open) {
    app.classList.toggle('sidebar-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Ocultar menu' : 'Mostrar menu');
  }

  btn.addEventListener('click', () => {
    const open = !isOpen();
    set(open);
    if (open) sidebar.querySelector('.nav-item:not(.hidden)')?.focus();
  });

  // Escolher uma página fecha o menu
  sidebar.addEventListener('click', e => {
    if (e.target.closest('.nav-item')) set(false);
  });

  // Clicar fora (no conteúdo ou no fundo escurecido) fecha
  document.addEventListener('click', e => {
    if (isOpen() && !sidebar.contains(e.target) && !btn.contains(e.target)) set(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !isOpen()) return;
    set(false);
    btn.focus();
  });
}
