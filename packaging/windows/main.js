/* Оболочка Windows для Phy.Sim: одно окно Electron, внутри — то же пособие.
   Интернет не нужен: содержимое (папка app/) лежит рядом с .exe. */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Один экземпляр: второй запуск разворачивает уже открытое окно, а не плодит копии
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#101318',   // без него при запуске мелькает белый прямоугольник
    show: false,
    title: 'Phy.Sim — физика в симуляциях',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      // Пособию ничего из Node не нужно — держим песочницу закрытой
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,   // физический цикл не должен замирать в фоне
    },
  });

  Menu.setApplicationMenu(null);      // меню нет: все команды внутри самого пособия
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // внешние ссылки — в системный браузер, а не поверх пособия
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
