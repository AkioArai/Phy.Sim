/* Оболочка Windows для Phy.Sim: одно окно Electron, внутри — то же пособие.
   Интернет не нужен: содержимое (папка app/) лежит рядом с .exe. */
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
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
    title: 'Phy.Sim',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      // Пособию ничего из Node не нужно — держим песочницу закрытой.
      // Наружу через preload отдана ровно одна функция: смена режима окна.
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,   // физический цикл не должен замирать в фоне
    },
  });

  Menu.setApplicationMenu(null);      // меню нет: все команды внутри самого пособия
  /* В заголовке окна — только «Phy.Sim». По умолчанию Electron подставляет
     туда <title> страницы, а там нужен полный вариант с подзаголовком: он
     идёт во вкладку браузера и в закладки. В окне приложения подзаголовок
     лишний — интерфейс держим строгим. */
  win.on('page-title-updated', (e) => e.preventDefault());
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // внешние ссылки — в системный браузер, а не поверх пособия
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* Режим окна из настроек пособия.
   «Весь экран в окне» — это не полноэкранный режим Windows, а окно без рамки
   на весь рабочий стол: Alt+Tab и всплывающие окна не выкидывают из
   приложения, а показывать с проектора так же удобно. Рамку окна на лету
   не убрать (setFrame нет), поэтому имитируем: убираем стандартную рамку
   через setMenuBarVisibility + максимизацию, а «поверх всего» не включаем —
   иначе поверх пособия не откроется даже диалог печати. */
function applyWindowMode(w, mode) {
  if (!w || w.isDestroyed()) return;
  if (mode === 'full') {
    w.setFullScreen(true);
  } else if (mode === 'fullwin') {
    w.setFullScreen(false);
    w.setMenuBarVisibility(false);
    w.maximize();
  } else {
    w.setFullScreen(false);
    if (w.isMaximized()) w.unmaximize();
  }
}
ipcMain.on('phy:window-mode', (e, mode) => {
  applyWindowMode(BrowserWindow.fromWebContents(e.sender), mode);
});

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// экспорт ради теста: проверяем выбор режима, не поднимая настоящее окно
module.exports = { applyWindowMode };
