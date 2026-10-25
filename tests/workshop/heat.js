simulation({
  title: 'Теплообмен двух тел',
  params: [
    { key: 'T1', label: 'Начальная температура горячего тела', unit: '°C', min: 0, max: 200, step: 1, default: 90 },
    { key: 'T2', label: 'Начальная температура холодного тела', unit: '°C', min: -20, max: 100, step: 1, default: 10 },
    { key: 'c1', label: 'Теплоёмкость горячего тела C₁', unit: 'Дж/К', min: 100, max: 5000, step: 50, default: 1000 },
    { key: 'c2', label: 'Теплоёмкость холодного тела C₂', unit: 'Дж/К', min: 100, max: 5000, step: 50, default: 2000 },
    { key: 'kt', label: 'Теплопередача через стенку', unit: 'Вт/К', min: 1, max: 100, step: 1, default: 20 },
    { key: 'loss', label: 'Теплопотери в комнату', type: 'check', default: false },
    { key: 'kl', label: 'Коэффициент потерь', unit: 'Вт/К', min: 0, max: 20, step: 0.5, default: 3, if: p => p.loss },
  ],
  view: { x: [-1.4, 1.4], y: [-0.4, 1.3] },
  init(p) { return { t: 0, T1: p.T1, T2: p.T2, Q: 0, done: false }; },
  dt: 1 / 60,
  step(s, dt, p) {
    const P = p.kt * (s.T1 - s.T2);                // поток тепла от 1 к 2, Вт
    const L1 = p.loss ? p.kl * (s.T1 - 20) : 0, L2 = p.loss ? p.kl * (s.T2 - 20) : 0;
    s.T1 += (-P - L1) / p.c1 * dt * 10;            // время ускорено в 10 раз
    s.T2 += (P - L2) / p.c2 * dt * 10;
    s.Q += P * dt * 10;
    s.t += dt * 10;
    if (!s.done && Math.abs(s.T1 - s.T2) < 0.1) { s.done = true; s.stop = 'Температуры сравнялись'; }
  },
  readouts(s, p) {
    const Tf = (p.c1 * p.T1 + p.c2 * p.T2) / (p.c1 + p.c2);
    return [['T₁', s.T1, '°C'], ['T₂', s.T2, '°C'], ['передано тепла', s.Q, 'Дж'], ['равновесная (без потерь)', Tf, '°C']];
  },
  graphs: [{ label: 'температуры', unit: '°C', series: ['T₁', 'T₂'], get: s => [s.T1, s.T2] }],
  draw(d, s, p) {
    const K = 273.15;
    d.block(-1.1, 0, 1, 1, { color: { T: s.T1 + K }, fill: { T: s.T1 + K }, label: '1' });
    d.block(0.1, 0, 1, 1, { color: { T: s.T2 + K }, fill: { T: s.T2 + K }, label: '2' });
    d.rect(-0.1, 0, 0.2, 1, { color: 'ink3', fill: true });
    d.thermometer(-0.6, 1.05, 0.2, (s.T1 + 20) / 220);
    d.thermometer(0.6, 1.05, 0.2, (s.T2 + 20) / 220);
    const P = p.kt * (s.T1 - s.T2);
    if (Math.abs(P) > 1) d.arrow(-0.35, 0.5, 0.35, 0.5, { color: 'danger', label: 'Q', width: 2 });
    d.ground(-1.3, 0, 1.3, 0);
  },
});
