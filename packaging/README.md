# Packaging Phy.Sim as apps

Phy.Sim is a plain web page, so an "app" here is a thin shell around the very same
source. There is no separate codebase: edits in `js/` and `css/` land in the
browser, in the `.apk` and in the `.exe` alike.

Formulas, styles and all 76 simulations live inside the bundle — the apps never
touch the network (that is why KaTeX moved from a CDN into `vendor/katex/`).

```
packaging/
  icon.svg           icon source: an elastic collision and the "Phy.Sim" wordmark
  icon-512.png       the same icon rasterised — used by the .exe
  android/           Android shell + an .apk build that needs no Android SDK
  windows/           Electron shell + electron-builder configuration
```

The icon is drawn in `icon.svg`; `icon-512.png` and
`android/res/mipmap-*/ic_launcher.png` (48–192 px) are rasterised from it. The same
drawing is embedded in `index.html` as the tab icon, so browser, phone and desktop
all show one icon.

---

## Android — `.apk`

```bash
npm run build:apk    # → packaging/android/out/phy-sim.apk
```

The first run downloads three files (~130 MB) from Maven Central into
`packaging/android/.tools/`; after that the build is offline and takes seconds.
You need **JDK 17+** (`javac`, `keytool`, `jarsigner`), plus `curl`, `unzip` and
`zip`. **Android Studio and the Android SDK are not required.**

How it works (details in the comments of `build-apk.mjs`):

| what | where it comes from |
|------|---------------------|
| `aapt2` | bundled inside `org.apktool:apktool-lib` (which also carries the framework resources) |
| `android.jar` | `org.robolectric:android-all` — compile-time only |
| `.class` → `classes.dex` | `com.jakewharton.android.repackaged:dalvik-dx` |
| signing | `jarsigner` from the JDK, scheme v1 |

A signing key is generated on the first build — `packaging/android/phy-sim.keystore`
(password `physim`). **Keep that file.** Installing an update over an existing
install only works with the same key; with a new one the old version must be
uninstalled first.

`targetSdkVersion` is deliberately `29`: from 30 onwards Android demands signature
scheme v2 and an uncompressed, aligned `resources.arsc`, which need `apksigner` and
`zipalign` from the SDK. This does not affect installation — the app installs on
everything from Android 5.0 up.

### Installing on a phone

Copy `phy-sim.apk` to the device, open it, allow installation from this source.
The app requests no permissions and makes no network calls.

### If you do have the Android SDK

Then sign it properly and you can raise `targetSdkVersion`:

```bash
zipalign -f 4 out/phy-sim.apk out/phy-sim-aligned.apk
apksigner sign --ks phy-sim.keystore --ks-pass pass:physim out/phy-sim-aligned.apk
```

---

## Windows — `.exe`

The shell is Electron, the installer is NSIS. Everything is configured in
`packaging/windows/package.json`.

### On Windows — the easy way

Install [Node.js](https://nodejs.org) (the **LTS** button, ordinary
next-next-finish installer). Then double-click
`packaging\windows\build-exe.bat`. It installs the dependencies and produces both
files in `packaging\windows\out\`.

By hand, in PowerShell or Command Prompt:

```bat
cd C:\path\to\Phy.Sim
cd packaging\windows
npm install
npm run dist
```

### On Fedora / Ubuntu — cross-building

Works, but needs Wine — **including the 32-bit one**: `rcedit` (icon and file
properties) and the NSIS installer are 32-bit programs.

```bash
# Fedora
sudo dnf install -y nodejs wine wine.i686
# Ubuntu / Debian
sudo dpkg --add-architecture i386 && sudo apt update
sudo apt install -y nodejs npm wine64 libgd3:i386 wine32:i386

bash packaging/windows/build-exe.sh
```

The script creates a separate `WINEARCH=win32` prefix, which is mandatory: with a
64-bit Wine the build dies on *"'/root/.wine' is a 64-bit installation, it cannot be
used with a 32-bit wineserver"*.

On Ubuntu `libgd3:i386` has to be installed on its own line — otherwise apt cannot
resolve the dependencies of `wine32:i386` and answers "held broken packages".

`npm run dist` produces two files (~83 MB each — that is Electron itself; the
textbook inside is under 4 MB):

* **`Phy.Sim Setup 1.0.0.exe`** — NSIS installer: asks for a folder, adds a desktop
  shortcut, installs without administrator rights;
* **`Phy.Sim-portable-1.0.0.exe`** — a single file that runs from anywhere (a flash
  drive, the Downloads folder) without installing. Usually the better choice for a
  school computer.

What the shell already does (`main.js`): a 1440×900 window with no system menu, a
dark backdrop (otherwise a white rectangle flashes on start), `backgroundThrottling`
disabled (Windows would otherwise throttle the physics loop in a minimised window),
no navigation outside the textbook, and one instance per machine. The window mode —
windowed, full screen, or borderless full screen — is switched from the app's own
settings through `preload.js`.

### Without Electron

If 83 MB feels excessive, build nothing: `phy-sim-standalone.html` (one file,
2.6 MB) opens by double-clicking in any browser and works offline exactly the same
way — it just has no Start-menu icon of its own.
