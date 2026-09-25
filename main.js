const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs   = require('fs');
const { initAutoUpdater } = require('./updater');

const IS_DEV  = process.argv.includes('--dev');

const VITE_DEV_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#FFFFFF',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    win.loadURL(VITE_DEV_URL).catch(() => {
      console.warn('[main] Vite não disponível — carregando renderer/index.html');
      win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const distIndex = path.join(__dirname, 'dist-renderer', 'index.html');
    if (fs.existsSync(distIndex)) {
      win.loadFile(distIndex);
    } else {
      win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    }
  }

  win.once('ready-to-show', () => win.show());
}

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
