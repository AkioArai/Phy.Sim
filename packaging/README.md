# Упаковка Phy.Sim в приложения

Пособие — обычная веб-страница, поэтому «приложение» здесь это тонкая
оболочка вокруг той же самой сборки `dist/`. Никакой отдельной версии
кода нет: правки в `js/` и `css/` попадают и в браузер, и в `.apk`, и в `.exe`.

Формулы, стили и все 76 симуляций лежат внутри — интернет приложению не нужен
(KaTeX переехал с CDN в `vendor/katex/` как раз ради этого).

```
packaging/
  icon.svg           исходник иконки: упругое соударение и «Phy.Sim»
  icon-512.png       та же иконка растром — для .exe
  android/           оболочка Android + сборка .apk без Android SDK
  windows/           оболочка Electron + настройки .exe
```

Иконка нарисована в `icon.svg`; из него растеризованы `icon-512.png` и
`android/res/mipmap-*/ic_launcher.png` (48–192 px). Та же картинка встроена
в `index.html` как значок вкладки, поэтому она одна на все версии: браузер,
телефон, компьютер.

---

## Android — `.apk`

```bash
npm run build        # сначала защищённая сборка dist/
npm run build:apk    # → packaging/android/out/phy-sim.apk
```

Первый запуск скачает с Maven Central три файла (около 130 МБ) в
`packaging/android/.tools/`; дальше сборка идёт офлайн за несколько секунд.
Нужны только **JDK 17+** (`javac`, `keytool`, `jarsigner`), `curl`, `unzip`
и `zip` — Android Studio и Android SDK не требуются.

Как это устроено (подробности — в комментариях `build-apk.mjs`):

| что                    | откуда                                          |
|------------------------|-------------------------------------------------|
| `aapt2`                | внутри `org.apktool:apktool-lib` (там же лежат ресурсы системы) |
| `android.jar`          | `org.robolectric:android-all` — для компиляции   |
| `.class` → `classes.dex` | `com.jakewharton.android.repackaged:dalvik-dx`  |
| подпись                | `jarsigner` из JDK, схема v1                     |

Ключ подписи создаётся сам при первой сборке — `packaging/android/phy-sim.keystore`
(пароль `physim`). **Сохраните этот файл.** Обновление «поверх» установленной
версии возможно только с тем же ключом; с новым придётся сначала удалить
старую версию.

`targetSdkVersion` намеренно `29`: с 30 и выше Android требует подпись схемы
v2 и выровненный `resources.arsc`, а для этого нужны `apksigner` и `zipalign`
из SDK. На установку это не влияет — приложение ставится на Android от 5.0
до последних версий.

### Установка на телефон

Скопировать `phy-sim.apk` на устройство, открыть, разрешить установку из
этого источника. Приложение не просит ни одного разрешения и не ходит в сеть.

### Если Android SDK всё-таки есть

Тогда проще собрать штатно и получить подпись v2/v3 (и возможность поднять
`targetSdkVersion`):

```bash
zipalign -f 4 out/phy-sim.apk out/phy-sim-aligned.apk
apksigner sign --ks phy-sim.keystore --ks-pass pass:physim out/phy-sim-aligned.apk
```

---

## Windows — `.exe`

Оболочка — Electron, установщик — NSIS. Всё настроено в
`packaging/windows/package.json`.

### На Windows — проще всего

Нужен только [Node.js](https://nodejs.org) (кнопка **LTS**, обычный
установщик «далее-далее-готово»). Дальше — двойной клик по
`packaging\windows\build-exe.bat`. Он сам поставит зависимости и соберёт оба
файла в `packaging\windows\out\`.

Если хочется руками, в PowerShell или «Командной строке»:

```bat
cd C:\путь\к\Phy.Sim
npm install
npm run build
cd packaging\windows
npm install
npm run dist
```

### На Fedora / Ubuntu — кросс-сборка

Работает, но нужен Wine, причём **32-битный тоже**: `rcedit` (иконка и
свойства файла) и установщик NSIS — 32-битные программы.

```bash
# Fedora
sudo dnf install -y nodejs wine wine.i686
# Ubuntu / Debian
sudo dpkg --add-architecture i386 && sudo apt update
sudo apt install -y nodejs npm wine64 libgd3:i386 wine32:i386

bash packaging/windows/build-exe.sh
```

Скрипт сам создаёт отдельный `WINEARCH=win32` префикс — это обязательно:
с 64-битным Wine сборка падает на «`'/root/.wine' is a 64-bit installation,
it cannot be used with a 32-bit wineserver`».

На Ubuntu `libgd3:i386` приходится ставить отдельной строкой: иначе apt
не разрешает зависимости `wine32:i386` и отвечает «held broken packages».

`npm run dist` делает сразу два файла (по 83 МБ — столько занимает сам
Electron, содержимое пособия там меньше четырёх мегабайт):

* **`Phy.Sim Setup 1.0.0.exe`** — установщик NSIS: спрашивает папку, кладёт
  ярлык на рабочий стол, ставится без прав администратора;
* **`Phy.Sim-portable-1.0.0.exe`** — один файл, который запускается откуда
  угодно (флешка, папка «Загрузки»), ничего не устанавливая. Для школьного
  компьютера обычно удобнее именно он.

Что уже настроено в оболочке (`main.js`): окно 1440×900 без системного меню,
тёмная подложка (иначе при запуске мелькает белый прямоугольник), отключённый
`backgroundThrottling` — иначе Windows тормозит физический цикл в свёрнутом
окне, запрет на выход за пределы пособия и один экземпляр на систему.

`prepare.mjs` копирует в оболочку именно `dist/` (обфусцированную сборку),
поэтому в готовом `.exe` ответы к задачам так же нечитаемы, как в раздаче
для браузера.

### Без Electron

Если 150 МБ на установщик кажутся лишними, можно ничего не собирать:
`phy-sim-standalone.html` (один файл, 2,5 МБ) открывается двойным кликом в
любом браузере и работает офлайн точно так же — только без своей иконки в
меню «Пуск».
