simulation({
  title: 'Два груза на пружинах: связанные колебания',
  params: [
    { key: 'm1', label: 'Масса левого груза', unit: 'кг', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'm2', label: 'Масса правого груза', unit: 'кг', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'k', label: 'Жёсткость крайних пружин', unit: 'Н/м', min: 1, max: 100, step: 1, default: 20 },
    { key: 'kc', label: 'Жёсткость средней пружины', unit: 'Н/м', min: 0, max: 100, step: 0.5, default: 4 },
    { key: 'x1', label: 'Начальное смещение левого', unit: 'м', min: -0.5, max: 0.5, step: 0.01, default: 0.3 },
    { key: 'x2', label: 'Начальное смещение правого', unit: 'м', min: -0.5, max: 0.5, step: 0.01, default: 0 },
  ],
  presets: [
    { name: 'Биения: энергия перетекает', values: { x1: 0.3, x2: 0, kc: 2 } },
    { name: 'Синфазная мода', values: { x1: 0.3, x2: 0.3, m1: 1, m2: 1 } },
    { name: 'Противофазная мода', values: { x1: 0.3, x2: -0.3, m1: 1, m2: 1 } },
  ],
  view: { x: [-0.2, 3.2], y: [-0.6, 0.9] },
  init(p) { return { t: 0, x1: p.x1, x2: p.x2, v1: 0, v2: 0 }; },
  step(s, dt, p) {
    const f = (t, y) => {
      const [x1, x2, v1, v2] = y;
      return [v1, v2, (-p.k * x1 + p.kc * (x2 - x1)) / p.m1, (-p.k * x2 - p.kc * (x2 - x1)) / p.m2];
    };
    [s.x1, s.x2, s.v1, s.v2] = rk4(f, [s.x1, s.x2, s.v1, s.v2], s.t, dt);
    s.t += dt;
  },
  readouts(s, p) {
    const E1 = p.m1 * s.v1 ** 2 / 2 + p.k * s.x1 ** 2 / 2, E2 = p.m2 * s.v2 ** 2 / 2 + p.k * s.x2 ** 2 / 2;
    return [['x₁', s.x1, 'м'], ['x₂', s.x2, 'м'], ['энергия левого', E1, 'Дж'], ['энергия правого', E2, 'Дж'],
            ['полная энергия', E1 + E2 + p.kc * (s.x2 - s.x1) ** 2 / 2, 'Дж']];
  },
  graphs: [{ label: 'смещения', unit: 'м', series: ['x₁', 'x₂'], get: s => [s.x1, s.x2] }],
  draw(d, s, p) {
    const A = 1, B = 2, w = 0.3, h = 0.3;
    d.ground(0, 0, 3, 0);
    d.ground(0, 0.6, 0, 0);       // левая стена
    d.ground(3, 0, 3, 0.6);       // правая стена
    const c1 = A + s.x1, c2 = B + s.x2;
    d.spring(0, h / 2, c1 - w / 2, h / 2, { coils: 8 });
    d.spring(c1 + w / 2, h / 2, c2 - w / 2, h / 2, { coils: 8, color: 'measure' });
    d.spring(c2 + w / 2, h / 2, 3, h / 2, { coils: 8 });
    d.block(c1 - w / 2, 0, w, h, { color: 'accent', label: 'm₁' });
    d.block(c2 - w / 2, 0, w, h, { color: 'second', label: 'm₂' });
    d.line(A, -0.1, A, -0.3, { color: 'line' }); d.line(B, -0.1, B, -0.3, { color: 'line' });
    d.text(A, -0.42, 'x₁ = 0', { color: 'ink3', size: 10 });
    d.text(B, -0.42, 'x₂ = 0', { color: 'ink3', size: 10 });
  },
  handles(s, p) {
    return [
      { x: 1 + p.x1, y: 0.15, label: 'x₁', drag: x => ({ x1: x - 1 }) },
      { x: 2 + p.x2, y: 0.15, label: 'x₂', drag: x => ({ x2: x - 2 }) },
    ];
  },
});
