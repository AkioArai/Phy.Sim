# Phy.Sim

**An interactive physics textbook where every formula has a live simulation next to it.**

Read the theory, change the numbers, watch what happens. 76 simulations, 380 problems
and the whole course from kinematics to quarks — in a single HTML file that runs
offline, with no install and no account.

> The course content is in **Russian** (it follows J. Orear's *Physics*, vols. 1–2).
> The code, build scripts and this document are in English.

<p align="center">
  <img src="docs/media/01-notes-and-sim.png" width="900" alt="Notes and a live simulation side by side">
</p>

---

## Demo

<!-- TRAILER: upload the video file straight into this README on GitHub
     (edit the file → drag & drop the .mp4 → GitHub inserts a
     https://github.com/user-attachments/assets/... link) and replace the
     poster line below with that link. GitHub renders it as a player. -->

<p align="center">
  <a href="docs/media/03-simulation-dark.png">
    <img src="docs/media/03-simulation-dark.png" width="900" alt="Trailer — click to play">
  </a>
  <br><em>▶ Trailer — coming soon</em>
</p>

---

## Try it in 30 seconds

| I want to… | Do this |
|---|---|
| **Just look at it** | Download [`phy-sim-standalone.html`](phy-sim-standalone.html) and open it. One file, 2.6 MB, works offline, no server. |
| **Run from source** | `git clone` → open `index.html`. No build step, no dependencies. |
| **Install on Android** | Grab `phy-sim.apk` from [Releases](../../releases), or build it: `npm run build:apk`. |
| **Install on Windows** | Grab the `.exe` from [Releases](../../releases), or build it: double-click `packaging\windows\build-exe.bat`. |

There is nothing to configure. No sign-in, no telemetry, no network requests —
KaTeX and its fonts ship inside the repository.

---

## What's inside

|  |  |
|---|---|
| **76** interactive simulations | mechanics · thermodynamics · electricity · magnetism · waves & optics · quantum · nuclear |
| **34** topics in **7** sections | full lecture notes, written to be read, not skimmed |
| **252** key formulas | each one opens the simulation that shows it working |
| **380** problems | five per simulation: one to get oriented, three to think about, one olympiad-grade |
| **133** common mistakes | the wrong idea, the right one, and why the wrong one is tempting |
| **125** cross-links | the same idea traced across mechanics, thermodynamics and quantum physics |
| **56** settings | theme, density, scene decorations, performance, recording |

### Problems that can't be looked up

Every answer is computed from the **current parameters of the linked simulation**.
Change the mass and the answer changes — so your neighbour's answer is different,
and nothing can be copied off the readouts panel. A build-time audit checks that no
problem is solvable by simply reading a number off the screen.

<p align="center">
  <img src="docs/media/02-problems.png" width="900" alt="Problems tab with progress tracking">
</p>

### A real instrument, not a slideshow

Pan, zoom, box-zoom, coordinate probe, ruler, dimension line, protractor, circle,
polygon area, notes, guides, body trails. Parameter fields accept expressions
(`2*9.8`). A timeline scrubs the computed history frame by frame. Panels float,
resize and collapse. `Ctrl+P` opens a command palette over everything —
topics, simulations, settings, commands.

<p align="center">
  <img src="docs/media/03-simulation-dark.png" width="900" alt="Full-screen simulation, dark theme">
  <img src="docs/media/04-settings.png" width="900" alt="Settings">
</p>

### Built for a phone, not shrunk onto one

A separate layout: a 35 px header, notes as plain text, a drawer for topics, a
floating control bar and a parameter sheet. Tools open as folders. Sizes come from
the *visual* viewport, so the browser's address bar never covers anything.

<p align="center">
  <img src="docs/media/05-mobile.png" width="270" alt="Phone: simulation">
  <img src="docs/media/06-mobile-tools.png" width="270" alt="Phone: tool folders">
</p>

---

## Build the apps

Both wrappers hold the same source — there is no separate mobile or desktop version.

### Android `.apk` — no Android Studio, no SDK

```bash
npm run build:apk        # → packaging/android/out/phy-sim.apk  (1.2 MB)
```

Needs only a JDK, `curl`, `zip` and `unzip`. The missing pieces (`aapt2`,
`android.jar`, the dexer) are fetched from Maven Central on first run. The app asks
for **zero permissions** and never touches the network.

### Windows `.exe`

```bash
cd packaging/windows && npm install && npm run dist
```

Produces an NSIS installer (no admin rights needed) and a portable `.exe` that runs
straight off a flash drive. On Windows you can just double-click
`packaging\windows\build-exe.bat`. Cross-building from Linux works too — see
[packaging/README.md](packaging/README.md) for the Wine setup.

### Single file

```bash
npm run build            # → phy-sim-standalone.html
```

Everything — styles, scripts, KaTeX, fonts — inlined into one HTML file you can
email, put on a flash drive, or open by double-clicking.

---

## Project layout

```
index.html            markup and script order — this is the dependency graph
css/style.css         all styles: light/dark themes, desktop and phone layouts
js/core.js            helpers and the empty SIMS registry
js/sims/*.js          the 76 simulations, grouped by branch of physics
js/topics.js          course content: notes, formulas, mistakes, links, problems
js/app.js             the core: state, canvases, render loop, the entire UI
vendor/katex/         KaTeX + fonts, so formulas render without a network
build-standalone.mjs  bundles everything into one HTML file
packaging/            Android and Windows wrappers, icon source
docs/ARCHITECTURE.md  contracts and design decisions (in Russian, like the code comments)
```

Plain `<script defer>` tags sharing one global scope — deliberately. ES modules
don't work over `file://`, and the whole point is that `index.html` opens by
double-clicking on any school computer.

**Adding a simulation** means adding one object to the `SIMS` registry with
`init` / `step` / `draw` / `fit`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the full contract.

---

## License

[GPL-3.0](LICENSE). Free to use, study, change and share — including in class.
