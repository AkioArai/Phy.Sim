```javascript
// Собирающая линза: построение изображения
simulation({
  title: 'Собирающая линза: построение изображения',
  static: true,
  params: [
    { key: 'F', label: 'Фокусное расстояние', unit: 'см', min: 5, max: 40, step: 1, default: 15 },
    { key: 'd', label: 'Расстояние от предмета до линзы', unit: 'см', min: 2, max: 80, step: 1, default: 35 },
    { key: 'h', label: 'Высота предмета', unit: 'см', min: 2, max: 20, step: 1, default: 8 },
    { key: 'rays', label: 'Показать все три луча', type: 'check', default: true },
  ],
  view: p => ({ x: [-Math.max(p.d, 2 * p.F) * 1.2 / 100, Math.max(60, 2.5 * p.F) / 100], y: [-0.25, 0.25] }),
  init(p) { return { t: 0 }; },
  readouts(s, p) {
    if (Math.abs(p.d - p.F) < 1e-9) return [['изображение', 'на бесконечности', '']];
    const f = p.d * p.F / (p.d - p.F), G = -f / p.d;
    return [['расстояние до изображения f', f, 'см'], ['увеличение Γ', G, ''],
            ['изображение', f > 0 ? 'действительное' : 'мнимое', ''], ['', G < 0 ? 'перевёрнутое' : 'прямое', '']];
  },
  draw(d, s, p) {
    const c = 0.01, F = p.F * c, D = -p.d * c, H = p.h * c, X = 1.5;
    d.line(-X, 0, X, 0, { color: 'line' });                    // оптическая ось
    d.arrow(0, -0.2, 0, 0.2, { color: 'ink2' }); d.arrow(0, 0.2, 0, -0.2, { color: 'ink2' });
    for (const x of [-F, F, -2 * F, 2 * F]) d.dot(x, 0, { color: 'ink2', size: 2.5 });
    d.label(F, 0, 'F', { color: 'ink3' }); d.label(-F, 0, 'F', { color: 'ink3' });
    d.arrow(D, 0, D, H, { color: 'accent', label: 'AB', width: 2.5 });
    if (Math.abs(p.d - p.F) < 1e-9) { d.caption(['Предмет в фокусе: лучи выходят параллельно, изображения нет']); return; }
    const f = p.d * p.F / (p.d - p.F) * c, Hi = -H * f / (p.d * c);
    // луч 1: параллельно оси, затем через фокус
    const k1 = -H / F;
    d.line(D, H, 0, H, { color: 'danger', width: 1.2 });
    d.line(0, H, X, H + k1 * X, { color: 'danger', width: 1.2 });
    if (f < 0) d.line(0, H, f, H + k1 * f, { color: 'danger', dash: true, width: 1 });
    // луч 2: через центр
    const k2 = H / D;
    d.line(D, H, X, k2 * X, { color: 'danger', width: 1.2 });
    if (f < 0) d.line(0, 0, f, k2 * f, { color: 'danger', dash: true, width: 1 });
    if (p.rays && D < -F) {
      // луч 3: через передний фокус, затем параллельно
      const y3 = H * (0 - (-F)) / (D - (-F));
      d.line(D, H, 0, y3, { color: 'danger', width: 1.2, alpha: 0.7 });
      d.line(0, y3, X, y3, { color: 'danger', width: 1.2, alpha: 0.7 });
    }
    d.arrow(f, 0, f, Hi, { color: 'second', label: "A'B'", width: 2.5, dash: f < 0 });
  },
  handles(s, p) {
    return [
      { x: -p.d / 100, y: p.h / 100, label: 'предмет', drag: (x, y) => ({ d: -x * 100, h: y * 100 }) },
      { x: p.F / 100, y: 0, label: 'фокус', drag: x => ({ F: x * 100 }) },
    ];
  },
});
```
