// Идеальный газ: молекулы в сосуде с поршнем
const N = 160;

simulation({
  title: 'Газ из молекул под поршнем',
  params: [
    { key: 'T', label: 'Температура', unit: 'К', min: 50, max: 1000, step: 10, default: 300 },
    { key: 'V', label: 'Ширина сосуда', unit: 'нм', min: 20, max: 80, step: 1, default: 50 },
    { key: 'n', label: 'Число молекул', min: 20, max: 400, step: 10, default: 160 },
  ],
  schema: true,
  view: { x: [-5, 95], y: [-8, 62] },
  timeUnit: 'пс',
  init(p) {
    const r = seeded(7), mol = [];
    const vt = Math.sqrt(p.T / 300) * 4;            // условная скорость: нм/пс
    for (let i = 0; i < p.n; i++) {
      const a = r() * 2 * Math.PI, v = vt * Math.sqrt(-2 * Math.log(1 - r() * 0.999));
      mol.push([r() * p.V, r() * 50, v * Math.cos(a), v * Math.sin(a)]);
    }
    return { t: 0, mol, imp: 0, P: 0, hist: [] };
  },
  dt: 1 / 120,
  step(s, dt, p) {
    let imp = 0;
    for (const m of s.mol) {
      m[0] += m[2] * dt; m[1] += m[3] * dt;
      if (m[0] < 0) { m[0] = -m[0]; m[2] = -m[2]; }
      if (m[0] > p.V) { m[0] = 2 * p.V - m[0]; imp += 2 * Math.abs(m[2]); m[2] = -m[2]; }   // удар о поршень
      if (m[1] < 0) { m[1] = -m[1]; m[3] = -m[3]; }
      if (m[1] > 50) { m[1] = 100 - m[1]; m[3] = -m[3]; }
    }
    s.hist.push(imp);
    if (s.hist.length > 240) s.hist.shift();
    s.P = s.hist.reduce((a, b) => a + b, 0) / (s.hist.length * dt) / 50;   // импульс за время на длину стенки
    s.t += dt;
  },
  readouts(s, p) {
    const ek = s.mol.reduce((a, m) => a + (m[2] * m[2] + m[3] * m[3]) / 2, 0) / s.mol.length;
    return [['давление на поршень (усл.)', s.P, ''], ['pV / N', s.P * p.V * 50 / p.n, ''], ['средняя энергия (усл.)', ek, '']];
  },
  graphs: [{ label: 'давление на поршень', unit: 'усл.', get: s => s.P }],
  draw(d, s, p) {
    d.gas(0, 0, p.V, 50, { T: p.T });
    d.vessel(0, 90, 0, 50, { bottom: true });
    d.rect(p.V, -2, 3, 54, { color: 'ink2', fill: 'ink2' });           // поршень
    d.line(p.V + 3, 25, 92, 25, { color: 'ink2', width: 3 });
    d.particles(s.mol.map(m => [m[0], m[1]]), { color: 'ink2', size: 2.2 });
    d.label(p.V / 2, 54, 'T = ' + p.T + ' К', { color: 'danger' });
  },
  handles(s, p) {
    return [{ x: p.V + 1.5, y: 25, label: 'поршень', drag: x => ({ V: x - 1.5 }) }];
  },
});
