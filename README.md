

# Phy.Sim

**A physics course you revise by running it.** The simulation comes first; the notes
are what you read when the simulation surprises you.

This is not a course that teaches physics from zero — it is a **full revision** of one,
from kinematics to quarks. Every topic opens with three things to try in a live
simulation, five points worth remembering, and the derivations behind the formulas.
81 simulations, 88 derivations and 409 problems, in a single HTML file that runs
offline, with no install and no account.

> The course content is in **Russian** (it follows J. Orear's *Physics*, vols. 1–2).
> The code, build scripts and this document are in English.

### Must read

This application was developed by the creator Somi together with Claude. The AI
assistant wrote practically all of the course notes on its own; the only places I
stepped in were the introduction and a few other topics. The mobile adaptation and
the entire architecture of this project were likewise built by Claude, and may well
contain plenty of bugs. [Bug reports](../../issues) are welcome.

<p align="center">
  <img src="docs/media/01-notes-and-sim.png" width="900" alt="Notes and a live simulation side by side">
</p>

---

## Demo


https://github.com/user-attachments/assets/efd65eac-32d3-40f8-8381-c8aeccb81596


<!-- TRAILER: upload the video file straight into this README on GitHub
     (edit the file → drag & drop the .mp4 → GitHub inserts a
     https://github.com/user-attachments/assets/... link) and replace the
     poster line below with that link. GitHub renders it as a player. -->

<p align="center">
  <a href="docs/media/03-simulation-dark.png">
    <img src="docs/media/03-simulation-dark.png" width="900" alt="Trailer — click to play">
  </a>
</p>

---

## Download

**[→ Get the latest build](../../releases/latest)** — pick the file for your system,
double-click it, done. No console, no toolchain, nothing to compile.

| System | File | What happens |
|---|---|---|
| **Windows 10/11** | `Phy.Sim-Setup-3.0.0.exe` | A normal setup wizard: a notice about how the course was written, your choice of folder, tick boxes for a Desktop and a Start-menu shortcut, then *Run Phy.Sim* or *Finish*. No admin rights required. |
| **Windows, no install** | `Phy.Sim-portable-3.0.0.exe` | Runs straight from a flash drive. Nothing is written to the system. |
| **Fedora** | `Phy.Sim-3.0.0.x86_64.rpm` | Double-click → *Software Install*, or `sudo dnf install ./Phy.Sim-3.0.0.x86_64.rpm`. Adds Phy.Sim to the applications menu. Fedora is the only Linux distribution this package is built and tested for. |
| **Android** | `phy-sim.apk` | Allow installing from your browser, then open the file. Asks for zero permissions, needs no Google services, and is signed with APK signature schemes v1, v2 and v3 so modern Android installs it without complaint. |
| **Any phone, no app store** | *open the web app → «Install»* | Works where an `.apk` cannot: Google services blocked, a vendor installer that refuses unknown sources, or an iPhone. The browser offers **Install**, you get a home-screen icon, no address bar, and it keeps working offline. |
| **Anything else** | [`phy-sim-standalone.html`](phy-sim-standalone.html) | One file, 3.6 MB. Open it in any browser — phone, tablet, school computer. Works offline. |

> The installers are attached to the release rather than committed to the
> repository: each one is ~80 MB, and a git repository keeps every copy of every
> file forever. The **Code** tab holds the source; the **Releases** page holds the
> ready-made builds.

### Installing without an app store

The repository ships `manifest.webmanifest` and `sw.js`, so the page served over
HTTPS is an installable web app. The `Publish web app` workflow puts it on GitHub
Pages; the owner enables it once under **Settings → Pages → Source: GitHub
Actions**. After that the address is `https://<owner>.github.io/<repo>/` — open it
on a phone and use *Install app* (Chrome) or *Share → Add to Home Screen*
(Safari). Everything is cached on first visit, so it opens with no network
afterwards.

Running from source needs nothing at all: `git clone` → open `index.html`.
No build step, no dependencies, no sign-in, no telemetry, no network requests —
KaTeX and its fonts ship inside the repository.

---

## What's inside

|  |  |
|---|---|
| **My path** | the handbook remembers what you solved and when: a map of all topics and what each stands on, a 12-problem diagnostic, spaced review, and a trainer for the skill behind your mistakes |
| **why the answer is wrong** | a wrong answer is checked against the answers that typical slips produce — sin for cos, degrees in radian mode, centimetres left unconverted, forgotten friction, a lost sign — and the slip is named |
| **46** questions to start from | "why doesn't a satellite fall?" — each opens the topic and the simulation where you can see the answer |
| **81** interactive simulations | mechanics · thermodynamics · electricity · magnetism · alternating current · waves & optics · relativity · quantum · nuclear |
| **circuit constructor** | draw wires, resistors and capacitors on a grid; node potentials, Kirchhoff's laws, equivalent capacitance and stored charge are solved live |
| **honest axes** | numbered axes only where one grid square really is one metre — never on schematics, PV-diagrams or spectra |
| **37** topics in **8** sections | each one opens with what to try, then five points to remember; the full notes are one click below, collapsed |
| **88** things to try | "change this — watch that": the experiment that makes the point, named before any theory |
| **145** points to remember | the five sentences per topic you would want on an exam morning |
| **88** derivations, **346** steps | every step revealed one at a time, each with the reason it is allowed — a formula you watched being built is not a formula you memorised |
| **calculator with units** | 72 км/ч в м/с, (2,5 ± 0,1) м / (3,0 ± 0,2) с, h c / (500 нм) в эВ — every number carries its dimension, adding metres to seconds is refused, uncertainty propagates |
| **202** course formulas, solvable | any of them for any of its quantities: T = 2π√(L/g) solved for g, with units and uncertainty; the rearranged formula is shown, not just the number |
| **40** math techniques, on the steps | every step is tagged with the mathematics it uses; a tag opens what the technique is, when it is legitimate, where it breaks — and every other derivation in the course that uses it |
| **prerequisites, stated** | a topic names what you must know first and offers a one-minute check before you start reading |
| **271** key formulas | each labelled *law*, *definition* or *consequence*, and each opens the simulation that shows it working |
| **409** problems | five per simulation: one to get oriented, three to think about, one olympiad-grade |
| **143** common mistakes | the wrong idea, the right one, and why the wrong one is tempting |
| **90** self-checks | three questions per topic, answers hidden until you have tried |
| **135** cross-links | the same idea traced across mechanics, thermodynamics and quantum physics |
| **reference sheet** | symbols, constants, units and the 40 techniques in Settings — the thing you would otherwise keep a browser tab open for |
| **77** settings, profiles | 8 themes, any accent colour, corners, fonts, column width, line spacing, animation level, button style; save your own profile and pass it on as a short code |
| **lab** | take noisy readings, straighten the axes (T² against L), fit a least-squares line with its uncertainties, export a CSV |
| **printable tests** | any number of variants, each with its own numbers, plus an answer key |

### New in 3.0: relativity, alternating current, a lab

3.0 is the release that rounds the course off.

- **Special relativity** is a section of its own, between optics and quantum physics.
  *Light clock*: a flash bouncing between two mirrors, at rest and in flight; the moving
  one ticks γ times slower, its light path is the diagonal of the Pythagorean triangle
  the derivation is built on, and a rod carried along is γ times shorter. *Minkowski
  diagram*: the rocket's axes close like scissors towards the light cone, events
  simultaneous for the rocket are not simultaneous on Earth, and 0.6c + 0.6c comes out
  as 0.88c while Galileo's answer runs outside the cone. *Constant force*: an electron in
  a field of one millivolt per metre, in real seconds — momentum grows evenly, energy
  without limit, speed only creeps up to c while Newton's answer overtakes light. Five
  derivations (time dilation, contraction, addition of velocities, E² = (pc)² + (mc²)²,
  K = (γ − 1)mc²), the muon example worked both ways, and 15 problems.
- **Alternating current** is a topic in Electromagnetism: a series RLC circuit with the
  current running round the schematic, the rotating phasors of the three voltages, and
  the resonance curve with the operating point on it. Effective values, reactances,
  impedance, the phase shift, resonance of voltages and cos φ — five derivations and
  five problems.
- **Scene layers**, for any simulation: a *stroboscope* that leaves the body's position
  at equal time steps, like a multiple-flash photograph; the *previous run* as a dashed
  ghost, to see what a parameter changed; a *camera that follows* the body; one colour
  per force across all mechanics scenes with a *legend and scale bar* (how many newtons
  in this length of arrow); a halo under every label, so text on top of a line stays
  readable. The orbit gets engine burns at apogee, perigee or a set time and the equal
  areas of Kepler's second law; the travelling wave shows its probe's phase vector.
- **The lab** (scene menu → Data): take readings with an adjustable scatter or a whole
  series over a parameter, straighten the axes, fit a least-squares line — slope and
  intercept with their standard errors, R² — and copy the table or save a CSV. From the
  pendulum's T² against L the slope gives 4π²/g within a couple of per cent.
- **Accessibility and speed**: tertiary text now meets 4.5 : 1 contrast in every palette,
  the scene carries a spoken description with its main readouts, verdicts and messages
  are announced, icon buttons have names; a device that keeps dropping under 24 fps is
  switched to economy settings once, with a message saying where to switch back.

### My path: a course that knows where you are

Someone learning alone has no one to say what they don't know, why an answer is
wrong, or when it is time to go back. **My path** (the button in the top bar, Ctrl+M)
does those three things, with nothing leaving the device.

- **Map.** All 29 topics laid out by what stands on what, each coloured by its state:
  not started, in progress, mastered, due for review, in trouble. Topics whose every
  prerequisite you have mastered are outlined — that is where you can go next. Pick a
  topic and the map names exactly which prerequisites are not there yet.
- **Diagnostic.** Twelve problems, one from each key topic from kinematics to quanta,
  with fresh numbers and a "Given" list. At the end it tells you where to start: the
  earliest failed topic that has no failed prerequisites of its own — fix that one and
  the others follow.
- **Today.** Mastered topics come back for review after 2, 5, 12, 28, 60 and 120 days;
  each review is one problem with new numbers, and a miss brings the topic back
  tomorrow. Below: skills to repair, topics where you are stuck and what is blocking
  them, and what to learn next.
- **Why the answer is wrong.** A wrong answer is compared with the answers typical slips
  produce, computed by the problem's own answer function with "spoiled" inputs: the
  angle measured from the other axis (sin for cos), degrees fed to a calculator in
  radian mode, centimetres or grams plugged in unconverted, a forgotten ×10²⁴, friction
  left out, two quantities swapped, a checkbox of the model ignored — and, from the
  number itself, a lost sign, a lost prefix, a lost ½ or 2π, g = 10 instead of 9.8. It
  needs no per-problem markup, so it works for all 409 problems. `npm run learn`
  reproduces 495 such slips across 163 problems and requires every one to be named,
  the correct answer never to be called a slip, and a random wrong number to get an
  explanation less than 10 % of the time (it is 1.8 %).
- **Skills.** Each slip belongs to one of ten skills — projections, radians, units,
  signs, numerical factors, powers, constants, reading the condition, the model, the
  forces. A skill has a short explanation, a rule to keep in front of you, a link to
  its technique in the reference, and a trainer with random numbers: five right in a
  row and the skill counts as repaired.
- **From a question.** Forty-six questions — why the sky is blue, why a satellite does not
  fall, how carbon dating works — each opening its topic and simulation.

There are no points, streaks or badges. Someone who opened a physics textbook on
their own already has the motivation; the job is not to waste it.

### A home screen, and colour that tells you where you are

The handbook opens on a home screen: continue where you stopped (with your mastery of
that topic), what My path has for today, the sections as cards — each with its own
colour and icon, number of topics and simulations, and how many you have mastered — a
question of the day, and a search box for topics, formulas and commands. A section card
leads to its first topic you have not mastered yet. If you would rather go straight to
the last topic, Settings → Behaviour → *On start*.

Each section keeps its colour everywhere: in the topic list, on the map, and in the
topic header, which now shows the section icon and a summary — reading time, formulas,
derivations, problems, simulations. A thin bar along the top shows how far you have
read, and a button takes you back to the start.

### Reading without the header in the way

The top bar now says where you can be — **Home · Course · My path** — in words, with a
search box for the whole course in the middle (Ctrl+P). The header of a topic — title,
summary, mastery, tabs — slides up out of the way as soon as you scroll down to read,
and comes back with the slightest scroll up; the text underneath does not move by a
pixel, so a card opened next to a formula stays next to it. **Reading mode** (the book
icon) hides the scene and the topic list in one click and brings back exactly what was
open. Boxes in the notes are flat cards now, without coloured frames or gradients.

### Weight, in a lift

A new simulation in *Dynamics*: a load on bathroom scales in a lift, drawn as a block whose
forces, mg and N, both act at its centre of mass — the material point of the second law. The ride has a
real lift's profile — accelerate, run at constant speed, brake; if the floor is too close
to reach full speed, the ride is triangular. The scales read m(g + a)/g: more than the
mass while accelerating upwards or braking on the way down, less in the opposite cases,
exactly the mass at constant speed — weight depends on acceleration, not on speed. Cut the
cable and the scales read zero while gravity is unchanged: weightlessness is free fall,
not the absence of gravity. Five problems come with it, up to a coin dropped at the moment
the lift starts; the profile is computed analytically, so the trip time in a problem
matches the model to the last digit, and three new physics checks hold it there.

### Make it yours

Since 2.2.1 the look is deliberately strict: corners of 3–7 px on one scale, short
straight transitions without overshoot, nothing that jumps under the cursor, monochrome
icons, section colour as a thin line only, difficulty as bars rather than coloured dots.

Settings open on **Main**: themes as live preview cards (light, dark, system, paper,
mint, nord, midnight for OLED, high contrast), ten accent colours or any colour you
pick — the text, fill and border shades are derived from it — text size, density,
animation level, button labels and style, corner radius. **Profiles** apply a set of
settings in one tap (Projector, Reading, Evening, Economy) and remember how it was,
so you can go back; your own profile can be saved and passed to someone else as a
short `PHYSIM1:` code. Short option lists are now segmented buttons, not drop-downs;
each section shows how many of its settings you have changed.

Buttons lift under the cursor, press in, and send a ripple from the point you touched;
menus, dialogs and panels slide in; hover hints appear at once and show the keyboard
shortcut. All of it follows the device's "reduce motion" setting and can be calmed or
switched off.

### A calculator that knows units

A phone calculator is useless for physics: it has no units, and the commonest
mistake of someone learning alone — an answer in the wrong units, or of the wrong
dimension altogether — goes unnoticed until the word *wrong*. Here every number
carries its dimension.

- **Count with units.** `72 км/ч в м/с` → `20 м/с`. `½ · 2 кг · (3 м/с)²` → `9 Дж`.
  `h c / (500 нм) в эВ` → `2,48 эВ`. Units are written in Russian, as throughout the
  course; Latin letters are constants (`g`, `c`, `G`, `h`, `e`, `k`, `kB`, `NA`, `R`,
  `ε0`, `μ0`, `me`), and every constant that was used is listed under the answer, so
  the Cyrillic *с* (second) and the Latin *c* (speed of light) never get confused
  silently.
- **Uncertainty.** `(2,5 ± 0,1) м / (3,0 ± 0,2) с` → `0,83 ± 0,06 м/с`, rounded the way
  a measurement is written. Every ± is an independent source and every result carries
  its derivatives with respect to all of them, so correlations are handled exactly:
  the same quantity subtracted from itself gives 0 ± 0, two independent measurements
  of it give ±√2.
- **Dimension check.** `2 м + 3 с` is refused with the reason. `Дж = Н` answers that
  the left side is larger by a metre. `ln(5 м)` explains that a logarithm needs a ratio.
  `sin 30` warns that it was taken in radians.
- **Solve any course formula for any quantity.** 202 of the 271 formulas parse into
  something solvable. Pick one — or press *решить* next to it in the notes — choose
  the unknown, type the rest with units, and get the answer with its unit and
  uncertainty, plus the formula rearranged for it: `g = 4π²L/T²`. When the unknown
  occurs twice (the time in `x = x₀ + v₀t + ½at²`) the root is found numerically and
  its dimension is inferred from the formula itself. Constants are filled in only where
  the letter unambiguously means them: `h` is Planck's constant in quantum physics and
  a height in mechanics. Formulas with vectors, integrals, derivatives or inequalities
  are not offered: `dx/dt` read as a product would quietly become `x/t`.
- **Answers to problems can have units.** `2,5 мДж` in a problem that asks for µJ is
  converted; `3 Н` in a problem that asks for joules is not "wrong" but "wrong
  dimension — a factor of metres is missing", which is a different mistake with a
  different cure.

`npm run calc` checks it: 17 groups of checks, including a round trip in which every
parsed formula is solved for every one of its quantities with random values and the
answer is substituted back — 924 cases.

### Mathematics where it is used, not in a chapter of its own

There is no mathematics section, on purpose. There was one — trigonometry and
vectors — and it was removed: a chapter on trigonometry sits beside the physics,
and nobody opens it. Instead, each of the 346 derivation steps says which
mathematics it is made of: substitution, resolving a vector along axes, the
small-angle approximation, the integral as a sum of small contributions, a check
against limiting cases — 40 techniques in all. Under each step they are small tags.
A tag opens a card: what the technique is, when it is legitimate, and where it
breaks, with the numbers worked out — `sin θ ≈ θ` is 0.5 % off at 10°, 2 % at 20°,
4.5 % at 30°, yet a pendulum swinging to 30° keeps its period within 1.7 %,
because the force is badly wrong only near the turning points. Below that, every
other derivation in the course that uses the same technique, one tap from the
exact step.

One tag is different: *physics*. It marks the steps where a law, a definition, an
experimental fact or a modelling assumption enters the derivation — the things that
do not follow from the previous line. Everything between them is transformation.
Seeing where the physics goes in is most of what it takes to rebuild a derivation
on your own.

`npm run curriculum` requires every step to name its techniques, every name to have
an article, and every article to be used by at least one step — so the reference
cannot quietly grow into the separate maths course it replaced.

### The derivative and the integral, on a graph that is still moving

Tap any graph under a running simulation and a tangent appears at that moment; its
slope *is* the derivative. Drag along a graph and the area under the curve fills in;
that area *is* the integral. The same moment is marked on every graph at once.

Where the course has both a quantity and its rate of change on screen, the handbook
checks one against the other in numbers. Tap x(t): the slope of the tangent, 6.27 m/s,
and the v(t) graph at the same instant, 6.27 m/s, marked *matches*. Drag along v(t)
from 3.85 s to 7.9 s: the area, −152 m, and the change in x over the same interval,
−152 m. The pendulum's angle is plotted in degrees and its angular velocity in rad/s;
the calculator converts one to the other before comparing. The EMF graph of Lenz's
law is compared with the slope of the flux taken *with a minus sign* — that minus is
the law. A card on each explains what a derivative or an integral is and links back
into the derivations that use one.

16 such pairs in 12 simulations: kinematics, the lift, projectile motion, circular motion,
rolling, the rocket, the three pendulums, damped oscillations, a point on a wave and
Lenz's law. They are marked by hand and only where the relation is exact: an orbit's
r(t) and v(t) have compatible units, but v is not dr/dt, and the handbook will not
pretend otherwise. `npm run graphs` runs each simulation for four seconds and requires
every marked pair to agree on average to within 5 %. Fifteen agree within half a per
cent; the EMF of a loop entering a field has genuine steps and agrees within 4 %. Flip
the sign on the EMF and the check fails at 200 %.

### Problems that can't be looked up

Most answers are computed from the **current parameters of the linked simulation**.
Change the mass and the answer changes — so your neighbour's answer is different.
An audit (`npm run audit`) runs all 409 problems against 40 randomised parameter
sets each and checks that none of them throws, returns a non-number, is unanswerable
for every input, compares a switch against a value the simulation doesn't have, or —
above level 1 — simply equals a number already shown in the readouts panel.

It also reports — as information, not as errors — the 82 problems whose answer is
deliberately parameter-independent (the conceptual ones: "how much work does the
tension do over one revolution?" — always zero), the level-1 problems that *are*
meant to be answered by reading the panel, and every answer that is proportional to
a single parameter, so its unit can be checked against that parameter's. Worth
knowing when you set homework.

### Graphs you can put in a report

The graph on the panel is a tape the render loop keeps: it starts where you pressed
play, is written at frame rate and ends where you paused. Fine for watching a process,
useless for a document — two runs with the same parameters give two different pictures.

**Menu → Скомпилировать график** does something else: it runs the simulation again
from the initial conditions, at a fixed step of its own, and samples the values on an
even time grid. Pick the interval, the number of points, the integration step, the
size and the format — **SVG, PNG or JPEG** — and you get a file. The same interval and
the same parameters always give the same image, down to the last digit.

Accuracy is the simulation's own integrator, and the step can be taken finer than the
one used on screen. Measured against `x = A·cos(ωt)` on the spring pendulum: at 1/240 s
the largest deviation is 3.8·10⁻⁴ m, four times finer 2.4·10⁻⁵, sixteen times finer
1.5·10⁻⁶ — on an amplitude of 0.6 m. The error falls as the *square* of the step. For
projectile motion the deviation from `y = y₀ + v₀sinθ·t − gt²/2` is exactly zero: that
graph is computed in closed form rather than integrated. Both checks run in
`npm test`.

Events are honoured: if the body lands, the curve stops there and the moment is marked
— the landing time matches `2v₀sinθ/g` to the digit. The plot has real margins on every
side, so the curve never touches the frame and the axis numbers are never clipped.

**The x-axis does not have to be time.** 38 of the 81 simulations are timeless —
nothing about them depends on time, they carry no graphs, and until now the compiler
refused them outright. That is all of quantum mechanics, most of optics, nuclear
physics and electrostatics. Put a *parameter* on the x-axis instead and each point
becomes a separate run of the model: the range against the angle of throw, the period
against the length, the efficiency against the cold-side temperature, the field against
the distance. Nothing is authored per simulation — the x menu is built from the numeric
parameters and the y menu from the readouts — so 78 of the 81 can now be compiled
instead of 36. Checked against Coulomb's law: sweeping a probe across a charged sphere,
`E·r²` outside it is constant to 2·10⁻¹⁶ relative spread, and the picture is the one
the textbook draws — linear inside, a peak at the surface, `1/r²` beyond.

On a phone the picture is sized to fit the browser's canvas limit — four graphs stacked
at double scale come to 13.8 megapixels, and a phone will render that **blank** without
raising a single error. Long intervals are integrated in 40 ms slices with a progress
readout instead of freezing the tab. Inside the Android app files are written by the
shell itself: a WebView without a download listener silently ignores `blob:` and
`data:` links, which is why compiling a graph, saving a frame, recording and exporting
data all did nothing there.

### Every simulation checked against the textbook

`npm run physics` is a separate harness: **573 checks** that take a simulation's
readouts and compare them with a number computed from the closed-form solution,
written out independently of the simulation's own code. Parameters are deliberately
un-round (a wrong coefficient hides behind a nice number), the reference constants
are listed separately from the ones the simulations use, and every check carries a
justified tolerance — `1e-9` for algebra, looser where a numerical integral or a
finite number of molecules is involved.

Conservation laws are checked as *behaviour*, not as formulas: the harness records
the readouts frame by frame and looks at how far a conserved quantity drifts over
the whole run, and separately at whether it ever **grows** where it must only decay
(mechanical energy under friction, kinetic energy in an inelastic collision).

<p align="center">
  <img src="docs/media/02-problems.png" width="900" alt="Problems tab with progress tracking">
</p>

### A real instrument, not a slideshow

Axes carry ticks and numbers, so a coordinate is read off the scene rather than
counted out in grid squares. Pan, selection, a freehand pencil, a ruler, a
circle, polygon area and notes. The ruler is also the vector (arrowheads) and
the dimension line (extension lines), and it measures in km, m, mm or nm to
0-3 decimals, with the angle to the horizontal on demand. Every drawing tool
carries its own colour — a colour wheel with the three most recent colours to
hand — thickness typed in pixels, line style and opacity on a slider. Hold
Shift while drawing to keep the direction at 0°, 45° or 90°; Alt + click erases
the mark under the cursor. Selection picks marks up and moves them instead of
making you erase and redraw. Each mark keeps the style it was drawn with, so
changing the colour never repaints what is already on the scene. Notes are
cards: a title that stays visible, a body that folds away, links to other
cards you can read without leaving the one you are on. Parameter
fields are grouped, and a group folds away with its own count of how many
values you have changed inside it. Parameter fields accept
expressions (`2*9.8`). A timeline scrubs the computed history frame by frame.
Panels float, resize and collapse. `Ctrl+P` opens a command palette over
everything — topics, simulations, settings, commands. `F11` cycles the window
mode: windowed → fullscreen → borderless fullscreen.

<p align="center">
  <img src="docs/media/03-simulation-dark.png" width="900" alt="Full-screen simulation, dark theme">
  <img src="docs/media/04-settings.png" width="900" alt="Settings">
</p>

### For teachers: a test where copying doesn't help

**Menu → Собрать контрольную**, or `Ctrl+P` → "контрольная". Pick the topics, the
difficulty levels, how many variants and how many problems each, and the app
prints a paper test.

Every variant gets **its own parameters for the linked simulations**, so every
variant has different answers. The numbers are printed into the problem itself —
the app works out which parameters actually affect the answer and lists only
those. A separate answer key comes at the end, and only `Ctrl+P` on that page
puts it on paper: the rest of the interface never prints.

The variant seed is on the dialog. The same seed always produces the same test,
so you can reprint a lost sheet, or mark work against a key printed weeks later.

### Built for a phone, not shrunk onto one

**The scene never leaves the screen.** Everything else arrives as a sheet from the
bottom with three positions, and the sheet does not cover the scene — it takes
height from it, so the simulation re-fits into whatever is left.

| Position | Sheet shows | Scene |
|---|---|---|
| **Peek** (default) | readouts, scrub, transport | full height above the sheet |
| **Half** | a whole tab: parameters, notes or a problem | shrinks |
| **Full** | reading, edge to edge | an 88 px live strip under the header, still running |

Each tab has a position of its own: parameters open at **half**, because you turn them
to watch the scene answer; notes and problems open at **full**, because reading needs
the page. At full the transport row and the scrub strip step aside — you are reading,
not watching — and play stays on the live strip itself. That is the difference between
160 pixels of text and 600.

Drag the grab bar or tap it to move between them. Parameters are 52 px rows where
the *value itself* is the slider — you drag the number sideways, which is where
your thumb already is, and the scene recomputes on every frame. Tools are one 56 px
dial by the thumb instead of a rail of twelve icons. Nothing tappable is under
44 px. Sizes come from the *visual* viewport, so the browser's address bar never
covers anything.

**Tablets** get whichever layout fits the moment. Upright, an iPad or a 10-inch
Android tablet uses the phone layout; turned on its side it switches to the desktop
one — and that is where things used to break. The splitter wrote the scene width in
pixels, which survived the rotation back and cut a strip off the phone layout; the
desktop layout's fixed columns left the notes 161–481 px on 960–1180 px screens. Now
the scene takes a share of the width, the notes never get less than 360 px, the topic
list lies over the notes below 1200 px instead of taking their width, and with a
finger every control in the desktop layout is at least 36 px.

**Old browsers.** Tablets installed outside an app store keep the WebView they shipped
with. Until 1.8.0 a single `?.` made the whole script unparseable on Chrome/WebView
below 80 and Safari below 13.1 — the page painted and did nothing. The scripts are now
ES2017 (Chrome 58, Safari 13 for pointer events), the stylesheet has plain fallbacks for
every modern function, and the page watchdog is ES5: on an engine that is too old it
names the engine and says what to update. `tests/compat.js` holds the line on every
`npm test`.

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

The installer's first page is [`notice.txt`](packaging/windows/notice.txt) — the
statement about how the course was written. The shortcut checkboxes live in
[`installer.nsh`](packaging/windows/installer.nsh).

### Fedora `.rpm`

```bash
cd packaging/windows && npm install && npm run dist:fedora
```

Needs `rpmbuild` on the build machine. Installs into `/opt/Phy.Sim` and adds a
desktop entry. Other distributions are not packaged — use the standalone HTML file.

### Everything at once

Push a tag and GitHub Actions builds all four and attaches them to a release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

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
tests/regress.js      pre-release suite: every simulation, formulas, layout
tests/physics.mjs     573 checks of readouts against closed-form solutions
tests/answers.mjs     all 409 problems against 40 random parameter sets each
tests/curriculum.mjs  the prerequisite graph, lesson blocks, technique tags
tests/calc.mjs        the calculator, and every course formula solved both ways
tests/graphs.mjs      every graph marked as a derivative of another, checked in numbers
tests/learn.mjs       the learner model: mastery, map, review, diagnostic, every slip
tests/lab.mjs         the lab's least-squares fit, scatter and number formatting
tests/compat.js       the engine floor: ES2017, an ES5 watchdog, CSS fallbacks
css/style.css         all styles: light/dark themes, desktop and phone layouts
js/core.js            helpers and the empty SIMS registry
js/sims/*.js          the 81 simulations, grouped by branch of physics
js/topics.js          course content: notes, derivations, formulas, worked
                      examples, mistakes, self-checks, links, problems
js/ops.js             the 40 math techniques the derivation steps are tagged with
js/calc.js            the calculator: units, uncertainty, formula parser and solver
js/learn.js           the learner model: journal, mastery, review, slips, skills
js/path.js            the My path panel: today, map, diagnostic, skills, questions
js/home.js            section colours and icons, the topic header, the home screen
js/scene.js           scene layers: stroboscope, ghost, follow camera, force legend; accessibility
js/lab.js             the lab: readings, least-squares line, table and CSV
js/app.js             the core: state, canvases, render loop, the entire UI
vendor/katex/         KaTeX + fonts, so formulas render without a network
build-standalone.mjs  bundles everything into one HTML file
packaging/            Android and Windows wrappers, icon source
docs/ARCHITECTURE.md  contracts and design decisions (in Russian, like the code comments)
docs/CONTRIBUTING.md  how to add a topic or a simulation, step by step (in Russian)
docs/DEVICE-CHECKLIST.md  a 15-minute check on real devices before a release
docs/STORE.md         what goes to F-Droid, RuStore and Google Play
```

Plain `<script defer>` tags sharing one global scope — deliberately. ES modules
don't work over `file://`, and the whole point is that `index.html` opens by
double-clicking on any school computer.

**Adding a simulation** means adding one object to the `SIMS` registry with
`init` / `step` / `draw` / `fit`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the full contract.

**Before releasing**, run all the suites. `npm test` checks the engine floor, the
calculator, the derivative pairs between graphs the learner model and the lab, then boots both the source and the bundled single file, runs 300 steps of
every simulation, checks that no formula overflows its column, and walks the desktop,
phone and tablet layouts, rotating the tablet. `npm run physics` compares the
simulations with the textbook, `npm run audit` checks the problems, `npm run
curriculum` the structure of the course.

```bash
npm i -D playwright
npm test && npm run physics && npm run audit && npm run curriculum
```

---

## License

[GPL-3.0](LICENSE). Free to use, study, change and share — including in class.
