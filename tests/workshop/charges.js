// Электрическое поле двух точечных зарядов: силовые линии и зонд
const K = 8.99e9;

function field(x, y, p) {
  let Ex = 0, Ey = 0;
  for (const [qx, q] of [[-p.a / 2, p.q1], [p.a / 2, p.q2]]) {
    const dx = x - qx, dy = y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
    if (r < 1e-6) continue;
    const E = K * q * 1e-9 / r2;
    Ex += E * dx / r; Ey += E * dy / r;
  }
  return [Ex, Ey];
}

simulation({
  title: 'Поле двух зарядов',
  static: true,
  params: [
    { key: 'q1', label: 'Заряд q₁', unit: 'нКл', min: -10, max: 10, step: 0.5, default: 5 },
    { key: 'q2', label: 'Заряд q₂', unit: 'нКл', min: -10, max: 10, step: 0.5, default: -5 },
    { key: 'a', label: 'Расстояние между зарядами', unit: 'м', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'lines', label: 'Линий от заряда', min: 4, max: 24, step: 2, default: 12 },
  ],
  view: { x: [-2, 2], y: [-1.3, 1.3] },
  init(p) { return { t: 0 }; },
  readouts(s, p) {
    const [Ex, Ey] = field(0, 0, p);
    return [['поле в середине E', Math.hypot(Ex, Ey), 'В/м'], ['сила между зарядами', K * Math.abs(p.q1 * p.q2) * 1e-18 / (p.a * p.a), 'Н']];
  },
  draw(d, s, p) {
    for (const [qx, q] of [[-p.a / 2, p.q1], [p.a / 2, p.q2]]) {
      if (q === 0) continue;
      for (let i = 0; i < p.lines; i++) {
        const a0 = 2 * Math.PI * i / p.lines, sgn = Math.sign(q), pts = [];
        let x = qx + 0.06 * Math.cos(a0), y = 0.06 * Math.sin(a0);
        for (let k = 0; k < 400; k++) {
          pts.push([x, y]);
          const [Ex, Ey] = field(x, y, p), E = Math.hypot(Ex, Ey);
          if (E === 0 || !isFinite(E)) break;
          x += sgn * 0.02 * Ex / E; y += sgn * 0.02 * Ey / E;
          if (Math.abs(x) > 2.5 || Math.abs(y) > 1.6) break;
          if (Math.hypot(x - (-p.a / 2), y) < 0.05 || Math.hypot(x - p.a / 2, y) < 0.05) { pts.push([x, y]); break; }
        }
        d.path(pts, { color: 'ink3', width: 1 });
      }
    }
    for (const [qx, q, name] of [[-p.a / 2, p.q1, 'q₁'], [p.a / 2, p.q2, 'q₂']]) {
      d.circle(qx, 0, 0.06, { fill: q > 0 ? 'danger' : (q < 0 ? 'accent' : 'ink3') });
      d.text(qx, 0, q > 0 ? '+' : (q < 0 ? '−' : ''), { color: 'canvas', size: 13, bold: true });
      d.label(qx, 0.06, name, {});
    }
  },
  handles(s, p) {
    return [{ x: p.a / 2, y: 0, label: 'расстояние', drag: x => ({ a: 2 * Math.abs(x) }) }];
  },
  probe(x, y, s, p) {
    const [Ex, Ey] = field(x, y, p), E = Math.hypot(Ex, Ey);
    let phi = 0;
    for (const [qx, q] of [[-p.a / 2, p.q1], [p.a / 2, p.q2]]) phi += K * q * 1e-9 / Math.max(1e-6, Math.hypot(x - qx, y));
    return ['E = ' + E.toFixed(1) + ' В/м', 'φ = ' + phi.toFixed(1) + ' В', 'направление ' + (Math.atan2(Ey, Ex) / deg).toFixed(0) + '°'];
  },
});
