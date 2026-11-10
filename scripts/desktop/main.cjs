const { app, BrowserWindow, Menu, net, protocol, session } = require('electron');
const { resolve, sep, join } = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('余烬旅人');
app.setPath('userData', join(app.getPath('appData'), 'EmberTraveler'));
protocol.registerSchemesAsPrivileged([{ scheme: 'ember', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window;

function createWindow() {
  window = new BrowserWindow({
    title: '余烬旅人', width: 1440, height: 900, minWidth: 960, minHeight: 640,
    backgroundColor: '#17130f', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('ember://game/')) event.preventDefault();
  });
  window.on('closed', () => { window = undefined; });
  window.loadURL('ember://game/');
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const root = resolve(__dirname, 'site');
    protocol.handle('ember', request => {
      try {
        const url = new URL(request.url);
        if (url.host !== 'game' || !['GET', 'HEAD'].includes(request.method)) return new Response('', { status: 403 });
        const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + sep)) return new Response('', { status: 403 });
        return net.fetch(pathToFileURL(file).toString());
      } catch { return new Response('', { status: 400 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:"],
    } }));
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
      { label: '余烬旅人', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'togglefullscreen' }] },
    ]) : null);
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
