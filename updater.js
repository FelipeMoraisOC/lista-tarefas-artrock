const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function initAutoUpdater() {
  if (process.argv.includes('--dev')) return;

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const win = BrowserWindow.getFocusedWindow();
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Atualização disponível',
      message: `Uma nova versão (${info.version}) foi baixada. O aplicativo será atualizado ao reiniciar.`,
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Check failed:', err.message);
    });
  }, 5000);
}

module.exports = { initAutoUpdater };
