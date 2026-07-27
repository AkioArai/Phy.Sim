/* Мостик между пособием и оболочкой окна.

   Страница живёт в песочнице без доступа к Node — и правильно. Наружу
   отдаём ровно одну функцию: сменить режим окна. Ничего, что позволяло бы
   читать файлы или выполнять произвольный код, здесь появляться не должно. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('physimShell', {
  /** 'window' | 'full' | 'fullwin' — см. applyWindowMode() в js/app.js */
  setWindowMode(mode) {
    if (['window', 'full', 'fullwin'].includes(mode)) ipcRenderer.send('phy:window-mode', mode);
  },
});
