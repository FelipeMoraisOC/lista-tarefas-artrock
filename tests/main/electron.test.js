// @vitest-environment node
//
// Funcionalidades do Electron: janela segura, fechar sem perder o timer,
// ponte do preload e atualização automática.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createElectronFake, mockModule, loadFresh } from './electron-fake.js';

let electron;

beforeEach(() => {
  electron = createElectronFake();
  mockModule('electron', electron);
});

async function openMainWindow() {
  loadFresh('main.js');
  await Promise.resolve();                // app.whenReady()
  await Promise.resolve();
  return electron.BrowserWindow.windows[0];
}

describe('Janela principal', () => {
  it('é criada com isolamento de contexto, sem Node no renderer e com o preload', async () => {
    const win = await openMainWindow();
    expect(win.options.webPreferences).toMatchObject({ contextIsolation: true, nodeIntegration: false });
    expect(win.options.webPreferences.preload).toMatch(/preload\.js$/);
  });

  it('carrega a tela empacotada; sem o build, cai no renderer/index.html', async () => {
    const exists = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    let win = await openMainWindow();
    expect(win.loadFile.mock.calls[0][0]).toMatch(/dist-renderer[\\/]index\.html$/);

    exists.mockReturnValue(false);
    electron.BrowserWindow.windows = [];
    win = await openMainWindow();
    expect(win.loadFile.mock.calls[0][0]).toMatch(/renderer[\\/]index\.html$/);
    expect(win.loadFile.mock.calls[0][0]).not.toMatch(/dist-renderer/);
  });

  it('em modo --dev, abre o servidor do Vite e as ferramentas de desenvolvimento', async () => {
    process.argv.push('--dev');
    try {
      const win = await openMainWindow();
      expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173');
      expect(win.webContents.openDevTools).toHaveBeenCalled();
    } finally {
      process.argv.pop();
    }
  });

  it('fechar todas as janelas encerra o app (Windows) e reativar recria a janela', async () => {
    await openMainWindow();
    const handler = name => electron.app.on.mock.calls.find(([ev]) => ev === name)[1];

    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      handler('window-all-closed')();
      expect(electron.app.quit).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }

    electron.BrowserWindow.windows = [];
    handler('activate')();
    expect(electron.BrowserWindow.windows).toHaveLength(1);
  });
});

describe('Fechar a janela sem perder o tempo do timer', () => {
  it('segura o fechamento e pede ao app para salvar', async () => {
    const win = await openMainWindow();
    const event = win.close();
    expect(event.defaultPrevented).toBe(true);
    expect(win.closed).toBe(false);
    expect(win.webContents.send).toHaveBeenCalledWith('app:before-close');
  });

  it('fecha assim que o app avisa que salvou', async () => {
    const win = await openMainWindow();
    win.close();
    electron.ipcMain.emit('app:close-ready', { sender: win.webContents });
    expect(win.closed).toBe(true);
  });

  it('ignora o aviso vindo de outra janela', async () => {
    const win = await openMainWindow();
    win.close();
    electron.ipcMain.emit('app:close-ready', { sender: {} });
    expect(win.closed).toBe(false);
  });

  it('se o app não responder em 4 segundos, fecha mesmo assim', async () => {
    vi.useFakeTimers();
    const win = await openMainWindow();
    win.close();
    vi.advanceTimersByTime(3999);
    expect(win.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(win.closed).toBe(true);
  });

  it('cliques repetidos no X enquanto salva não repetem o pedido', async () => {
    const win = await openMainWindow();
    win.close();
    win.close();
    win.close();
    expect(win.webContents.send).toHaveBeenCalledTimes(1);
    expect(electron.ipcMain.listenerCount('app:close-ready')).toBe(1);
  });

  it('com o app travado (renderer caiu), fecha direto', async () => {
    const win = await openMainWindow();
    win.webContents.crashed = true;
    win.close();
    expect(win.closed).toBe(true);
    expect(win.webContents.send).not.toHaveBeenCalled();
  });
});

describe('Ponte do preload (appLifecycle)', () => {
  function loadPreload() {
    loadFresh('preload.js');
    const [name, api] = electron.contextBridge.exposeInMainWorld.mock.calls[0];
    return { name, api };
  }

  it('expõe só a função de "antes de fechar" — nada do Node vai para a tela', () => {
    const { name, api } = loadPreload();
    expect(name).toBe('appLifecycle');
    expect(Object.keys(api)).toEqual(['onBeforeClose']);
  });

  it('ao fechar, espera o app salvar e só então libera a janela', async () => {
    const { api } = loadPreload();
    let finishSave;
    api.onBeforeClose(() => new Promise(r => { finishSave = r; }));

    electron.ipcRenderer.emit('app:before-close');
    await Promise.resolve();
    expect(electron.ipcRenderer.send).not.toHaveBeenCalled();

    finishSave();
    await vi.waitFor(() => expect(electron.ipcRenderer.send).toHaveBeenCalledWith('app:close-ready'));
  });

  it('mesmo se o salvamento falhar, a janela fecha (sem erro solto no processo)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { api } = loadPreload();
    api.onBeforeClose(() => Promise.reject(new Error('sem conexão')));
    electron.ipcRenderer.emit('app:before-close');
    await vi.waitFor(() => expect(electron.ipcRenderer.send).toHaveBeenCalledWith('app:close-ready'));
  });
});

describe('Atualização automática', () => {
  function fakeUpdater() {
    return Object.assign(new EventEmitter(), {
      checkForUpdates: vi.fn(() => Promise.resolve()),
      quitAndInstall: vi.fn(),
      autoDownload: false,
      autoInstallOnAppQuit: false,
    });
  }

  function setup({ isPackaged = true, response = 0 } = {}) {
    electron = createElectronFake({ isPackaged });
    electron.dialog.showMessageBox = vi.fn(() => Promise.resolve({ response }));
    mockModule('electron', electron);
    const autoUpdater = fakeUpdater();
    const loaded = vi.fn();
    mockModule('electron-updater', { get autoUpdater() { loaded(); return autoUpdater; } });
    const { initAutoUpdater } = loadFresh('updater.js');
    return { initAutoUpdater, autoUpdater, loaded };
  }

  it('fora do app instalado (desenvolvimento), não faz nada', () => {
    const { initAutoUpdater, loaded } = setup({ isPackaged: false });
    initAutoUpdater();
    expect(loaded).not.toHaveBeenCalled();
  });

  it('no app instalado: baixa sozinho, instala ao sair e verifica 5s depois de abrir', () => {
    vi.useFakeTimers();
    const { initAutoUpdater, autoUpdater } = setup();
    initAutoUpdater();
    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('atualização baixada: pergunta e, em "Reiniciar agora", instala', async () => {
    const { initAutoUpdater, autoUpdater } = setup({ response: 0 });
    initAutoUpdater();
    autoUpdater.emit('update-downloaded', { version: '1.2.0' });
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true));
    const [, options] = electron.dialog.showMessageBox.mock.calls[0];
    expect(options.message).toContain('1.2.0');
    expect(options.buttons).toEqual(['Reiniciar agora', 'Depois']);
  });

  it('em "Depois", não reinicia', async () => {
    const { initAutoUpdater, autoUpdater } = setup({ response: 1 });
    initAutoUpdater();
    autoUpdater.emit('update-downloaded', { version: '1.2.0' });
    await Promise.resolve();
    await Promise.resolve();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('registra no log os eventos do atualizador sem quebrar', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initAutoUpdater, autoUpdater } = setup();
    initAutoUpdater();
    autoUpdater.emit('update-available', { version: '1.2.0' });
    autoUpdater.emit('update-not-available');
    autoUpdater.emit('download-progress', { percent: 42.4 });
    autoUpdater.emit('error', new Error('falhou'));
    expect(console.log).toHaveBeenCalledWith('[updater] Download: 42%');
    expect(console.error).toHaveBeenCalledWith('[updater] Error:', 'falhou');
  });

  it('falha ao procurar atualização não derruba o app', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initAutoUpdater, autoUpdater } = setup();
    autoUpdater.checkForUpdates = vi.fn(() => Promise.reject(new Error('offline')));
    initAutoUpdater();
    await vi.advanceTimersByTimeAsync(5000);
    expect(console.error).toHaveBeenCalledWith('[updater] Check failed:', 'offline');
  });
});
