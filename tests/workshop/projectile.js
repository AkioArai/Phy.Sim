```js
// Бросок под углом: с сопротивлением воздуха и без
simulation({
  title: 'Бросок под углом с сопротивлением воздуха',
  params: [
    { type: 'group', label: 'Бросок' },
    { key: 'v0', label: 'Начальная скорость', unit: 'м/с', min: 1, max: 50, step: 0.5, default: 20 },
    { key: 'ang', label: 'Угол к горизонту', unit: '°', min: 0, max: 90, step: 1, default: 45 },
    { key: 'h0', label: 'Высота броска', unit: 'м', min: 0, max: 20, step: 0.5, default: 0 },
    { type: 'group', label: 'Воздух' },
    { key: 'm', label: 'Масса мяча', unit: 'кг', min: 0.05, max: 5, step: 0.05, default: 0.45 },
    { key: 'k', label: 'Коэффициент сопротивления k (F = k v²)', unit: 'кг/м', min: 0, max: 0.05, step: 0.001, default: 0.01 },
    { key: 'ideal', label: 'Показать параболу без воздуха', type: 'check', default: true },
  ],
  presets: [
    { name: 'Футбольный мяч', values: { v0: 25, ang: 35, m: 0.45, k: 0.006 } },
    { name: 'Бадминтонный волан: воздух решает всё', values: { v0: 30, ang: 45, m: 0.005, k: 0.0006 } },
  ],
  view: p => {
    const R = p.v0 * p.v0 / g + p.h0 * 1.5 + 2, H = p.h0 + p.v0 * p.v0 / (2 * g) + 1;
    return { x: [-1, Math.max(5, R)], y: [-1, Math.max(3, H)] };
  },
  init(p) {
    const a = p.ang * deg;
    return { t: 0, x: 0, y: p.h0, vx: p.v0 * Math.cos(a), vy: p.v0 * Math.sin(a),
             trail: [[0, p.h0]], ideal: [[0, p.h0]], done: false, xmax: 0, ymax: p.h0 };
  },
  step(s, dt, p) {
    s.t += dt;
    if (s.done) return;
    const v = Math.hypot(s.vx, s.vy), kk = p.k / p.m;
    s.vx += -kk * v * s.vx * dt;
    s.vy += (-g - kk * v * s.vy) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.ymax = Math.max(s.ymax, s.y);
    if (Math.round(s.t / dt) % 6 === 0) s.trail.push([s.x, s.y]);
    if (s.y <= 0 && s.t > dt) { s.y = 0; s.done = true; s.xmax = s.x; s.trail.push([s.x, 0]); s.stop = 'Мяч упал на землю'; }
  },
  readouts(s, p) {
    const a = p.ang * deg, vx = p.v0 * Math.cos(a), vy = p.v0 * Math.sin(a);
    const T = (vy + Math.sqrt(vy * vy + 2 * g * p.h0)) / g;
    return [
      ['дальность', s.done ? s.xmax : s.x, 'м'],
      ['наибольшая высота', s.ymax, 'м'],
      ['скорость', Math.hypot(s.vx, s.vy), 'м/с'],
      ['дальность без воздуха', vx * T, 'м'],
    ];
  },
  graphs: [
    { label: 'vx и vy', unit: 'м/с', series: ['vx', 'vy'], get: s => [s.vx, s.vy] },
    { label: 'высота y(t)', unit: 'м', get: s => s.y },
  ],
  draw(d, s, p) {
    const a = p.ang * deg;
    d.ground(-1, 0, 200, 0);
    if (p.ideal) {
      const vx = p.v0 * Math.cos(a), vy = p.v0 * Math.sin(a), T = (vy + Math.sqrt(vy * vy + 2 * g * p.h0)) / g, pts = [];
      for (let i = 0; i <= 60; i++) { const t = T * i / 60; pts.push([vx * t, p.h0 + vy * t - g * t * t / 2]); }
      d.path(pts, { color: 'ink3', dash: true });
    }
    d.trail(s.trail.concat([[s.x, s.y]]), { color: 'accent' });
    if (p.h0 > 0) d.rect(-0.6, 0, 0.6, p.h0, { color: 'ink3', fill: true });
    d.ball(s.x, s.y, 0.25, { color: 'accent' });
    const k = 0.15;
    d.arrow(s.x, s.y, s.x + s.vx * k, s.y + s.vy * k, { color: 'accent', label: 'v' });
  },
  handles(s, p) {
    const a = p.ang * deg, k = 0.15;
    return [{ x: p.v0 * Math.cos(a) * k, y: p.h0 + p.v0 * Math.sin(a) * k, label: 'v₀ — тяните',
      drag: (x, y) => ({ v0: Math.hypot(x, y - p.h0) / k, ang: Math.atan2(y - p.h0, x) / deg }) }];
  },
});
```
