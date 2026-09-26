// Electron falso para testar main.js, preload.js e updater.js sem abrir janelas.
//
// Os arquivos do processo principal usam `require('electron')` (CommonJS).
// Colocamos o fake no cache do require do Node: quem pedir 'electron' (ou
// 'electron-updater') recebe a versão falsa.

import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

export const requireCjs = createRequire(import.meta.url);

const ROOT = requireCjs.resolve('../../main.js').replace(/main\.js$/, '');

export function mockModule(name, exports) {
  const path = requireCjs.resolve(name);
  requireCjs.cache[path] = { id: path, filename: path, loaded: true, exports };
}

// Carrega um arquivo do projeto do zero (sem reaproveitar o cache).
export function loadFresh(file) {
  const path = requireCjs.resolve(`${ROOT}${file}`);
  delete requireCjs.cache[path];
  if (file !== 'updater.js') delete requireCjs.cache[requireCjs.resolve(`${ROOT}updater.js`)];
  return requireCjs(path);
}

export function createElectronFake({ isPackaged = false } = {}) {
  const ipcMain = new EventEmitter();
  const ipcRenderer = Object.assign(new EventEmitter(), { send: vi.fn() });
  const contextBridge = { exposeInMainWorld: vi.fn() };

  class WebContents extends EventEmitter {
    constructor() {
      super();
      this.send = vi.fn();
      this.crashed = false;
      this.openDevTools = vi.fn();
    }
    isCrashed() { return this.crashed; }
  }

  class BrowserWindow extends EventEmitter {
    static windows = [];
    static getAllWindows() { return BrowserWindow.windows; }
    static getFocusedWindow() { return BrowserWindow.windows[0] ?? null; }

    constructor(options) {
      super();
      this.options = options;
      this.webContents = new WebContents();
      this.closed = false;
      this.loadURL = vi.fn(() => Promise.resolve());
      this.loadFile = vi.fn();
      this.show = vi.fn();
      BrowserWindow.windows.push(this);
    }

    // Igual ao Electron: emite 'close'; se ninguém impedir, fecha.
    close() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      this.emit('close', event);
      if (!event.defaultPrevented) {
        this.closed = true;
        this.emit('closed');
      }
      return event;
    }
  }

  const app = {
    isPackaged,
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    quit: vi.fn(),
  };

  const dialog = { showMessageBox: vi.fn(() => Promise.resolve({ response: 1 })) };

  return { app, BrowserWindow, ipcMain, ipcRenderer, contextBridge, dialog };
}
