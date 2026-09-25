// preload.js — ponte mínima e segura entre o Electron e o renderer
// (contextIsolation permanece ativo; nada do Node é exposto diretamente).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appLifecycle', {
  // Chamado quando o usuário fecha a janela. O callback deve devolver uma
  // Promise; a janela só fecha quando ela terminar (ou após o limite do main).
  onBeforeClose(callback) {
    ipcRenderer.on('app:before-close', async () => {
      try { await callback(); } finally { ipcRenderer.send('app:close-ready'); }
    });
  },
});
