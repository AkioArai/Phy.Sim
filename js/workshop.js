/* ===================== МАСТЕРСКАЯ (10.0.0) =====================
   Своя симуляция без программирования: человек описывает явление словами,
   копирует задание (инструкция + описание) в любой ИИ, вставляет ответ —
   и запускает. Модель исполняется в песочнице (sandbox.js); здесь — всё
   вокруг: список своих симуляций, редактор, проверка с отчётом, который
   можно отправить ИИ обратно, инструкция с примерами, файлы и копирование.

   Текста и задач у самодельных симуляций нет намеренно: только модель —
   параметры, показания, графики, рисунок, ручки и зонд.                    */

/* ---------- Примеры из инструкции ----------
   Написаны настоящими функциями, а не строками: синтаксис проверяется сразу,
   и тесты прогоняют их через песочницу, как любой код от ИИ. На странице
   они не вызываются — в Мастерскую уходит текст их тела. */
function примерМаятник(){
  simulation({
    title: 'Маятник с затуханием',
    params: [
      { type: 'group', label: 'Маятник' },
      { key: 'L', label: 'Длина нити', unit: 'м', min: 0.2, max: 3, step: 0.05, default: 1 },
      { key: 'th0', label: 'Начальный угол', unit: '°', min: -170, max: 170, step: 1, default: 40 },
      { type: 'group', label: 'Сопротивление' },
      { key: 'damp', label: 'Учитывать сопротивление воздуха', type: 'check', default: false },
      { key: 'b', label: 'Коэффициент затухания', unit: '1/с', min: 0, max: 2, step: 0.05, default: 0.3, if: p => p.damp },
    ],
    presets: [
      { name: 'Малые колебания: период не зависит от угла', values: { L: 1, th0: 5, damp: false } },
      { name: 'Почти вверх ногами', values: { L: 1, th0: 170, damp: false } },
      { name: 'Затухающие колебания', values: { L: 1.5, th0: 60, damp: true, b: 0.4 } },
    ],
    view: p => ({ x: [-p.L * 1.25, p.L * 1.25], y: [-p.L * 1.3, p.L * 0.35] }),

    init(p) {
      return { t: 0, th: p.th0 * deg, w: 0 };
    },
    step(s, dt, p) {
      const b = p.damp ? p.b : 0;
      s.w += (-(g / p.L) * Math.sin(s.th) - b * s.w) * dt;   // сначала угловая скорость…
      s.th += s.w * dt;                                     // …потом угол
      s.t += dt;
    },
    readouts(s, p) {
      const T0 = 2 * Math.PI * Math.sqrt(p.L / g);
      return [
        ['угол θ', s.th / deg, '°'],
        ['угловая скорость ω', s.w, 'рад/с'],
        ['период малых колебаний T₀', T0, 'с'],
      ];
    },
    graphs: [
      { label: 'θ(t) — угол', unit: '°', get: s => s.th / deg },
    ],
    draw(d, s, p) {
      const x = p.L * Math.sin(s.th), y = -p.L * Math.cos(s.th);
      d.ground(0.35, 0, -0.35, 0);                              // потолок: справа налево — штриховка сверху
      d.line(0, -p.L * 1.15, 0, 0, { color: 'line', dash: true });   // вертикаль
      d.line(0, 0, x, y, { color: 'ink2' });                    // нить
      d.pivot(0, 0);
      d.angle(0, 0, 0.3 * p.L, -Math.PI / 2, -Math.PI / 2 + s.th, { label: 'θ' });
      d.ball(x, y, 0.05 + 0.03 * p.L, { color: 'accent' });
      d.force(x, y, 0, -1, { kind: 'gravity', scale: 0.25 * p.L, label: 'mg' });
    },
    handles(s, p) {
      const a = p.th0 * deg;
      return [{
        x: p.L * Math.sin(a), y: -p.L * Math.cos(a), label: 'L и θ₀ — тяните',
        drag: (x, y) => ({ L: Math.hypot(x, y), th0: Math.atan2(x, -y) / deg }),
      }];
    },
  });
}
function примерИстечение(){
  // Сосуд с отверстием в боковой стенке: закон Торричелли v = μ√(2gh)
  const Y0 = 0.4;                           // дно сосуда стоит на подставке высотой 0,4 м

  simulation({
    title: 'Истечение из сосуда',
    params: [
      { key: 'H', label: 'Начальный уровень воды', unit: 'м', min: 0.2, max: 1.8, step: 0.05, default: 1.2 },
      { key: 'z', label: 'Высота отверстия над дном', unit: 'м', min: 0, max: 1, step: 0.05, default: 0.2 },
      { key: 'D', label: 'Диаметр сосуда', unit: 'см', min: 10, max: 80, step: 1, default: 40 },
      { key: 'dh', label: 'Диаметр отверстия', unit: 'мм', min: 2, max: 30, step: 1, default: 12 },
      { key: 'mu', label: 'Коэффициент расхода μ', min: 0.5, max: 1, step: 0.01, default: 0.62 },
    ],
    view: { x: [-0.6, 2.4], y: [-0.25, 2.4] },

    init(p) {
      return { t: 0, h: p.H, done: false };      // h — уровень воды над дном
    },
    step(s, dt, p) {
      s.t += dt;
      if (s.done) return;
      const R = p.D / 200, r = p.dh / 2000;      // радиусы сосуда и отверстия, м
      const above = s.h - p.z;                    // высота воды над отверстием
      if (above <= 0) { s.done = true; s.stop = 'Вода опустилась до отверстия — течь перестала'; return; }
      const v = p.mu * Math.sqrt(2 * g * above);  // скорость струи
      s.h -= v * (r * r) / (R * R) * dt;          // убыль объёма = расход
    },
    readouts(s, p) {
      const above = Math.max(0, s.h - p.z), v = p.mu * Math.sqrt(2 * g * above);
      const tf = Math.sqrt(2 * (Y0 + p.z) / g);   // время полёта струи до пола
      return [['уровень h', s.h, 'м'], ['скорость струи v', v, 'м/с'], ['дальность струи', v * tf, 'м']];
    },
    graphs: [
      { label: 'h(t) — уровень', unit: 'м', get: s => s.h },
    ],
    draw(d, s, p) {
      const R = p.D / 200, yh = Y0 + p.z;
      d.ground(-0.6, 0, 2.4, 0);                  // пол
      d.rect(-R * 0.7, 0, R * 1.4, Y0, { color: 'ink3', fill: true });   // подставка
      d.liquid(-R, Y0, R, Y0 + s.h, { kind: 'water' });
      d.vessel(-R, R, Y0, Y0 + 2);
      const above = s.h - p.z;
      if (above > 0) {
        const v = p.mu * Math.sqrt(2 * g * above), tf = Math.sqrt(2 * yh / g), pts = [];
        for (let i = 0; i <= 24; i++) { const t = tf * i / 24; pts.push([R + v * t, yh - g * t * t / 2]); }
        d.jet(pts, 0.006 + p.dh / 4000, { kind: 'water' });
      }
      d.dimension(-R, Y0, -R, Y0 + s.h, 'h', { offset: 18 });
    },
    handles(s, p) {
      const R = p.D / 200;
      return [
        { x: 0, y: Y0 + p.H, label: 'уровень', drag: (x, y) => ({ H: y - Y0 }) },
        { x: R, y: Y0 + p.z, label: 'отверстие', drag: (x, y) => ({ z: y - Y0 }) },
      ];
    },
    probe(x, y, s, p) {
      const R = p.D / 200;
      if (Math.abs(x) > R || y < Y0 || y > Y0 + s.h) return null;   // не в воде
      const depth = Y0 + s.h - y;
      return ['глубина ' + depth.toFixed(2) + ' м', 'давление ' + (101.3 + 1000 * g * depth / 1000).toFixed(1) + ' кПа'];
    },
  });
}
function примерБрусок(){
  simulation({
    title: 'Брусок на наклонной плоскости',
    params: [
      { key: 'a', label: 'Угол наклона α', unit: '°', min: 5, max: 60, step: 1, default: 30 },
      { key: 'L', label: 'Длина плоскости', unit: 'м', min: 1, max: 5, step: 0.1, default: 3 },
      { key: 'm', label: 'Масса бруска', unit: 'кг', min: 0.1, max: 10, step: 0.1, default: 2 },
      { key: 'mu', label: 'Коэффициент трения μ', min: 0, max: 1, step: 0.01, default: 0.2 },
      { key: 'forces', label: 'Показывать силы', type: 'check', default: true },
    ],
    view: p => ({ x: [-0.5, p.L + 0.4], y: [-0.7, p.L * 0.9 + 0.3] }),

    init(p) {
      return { t: 0, x: 0, v: 0, done: false };     // x — путь вдоль склона от вершины
    },
    step(s, dt, p) {
      s.t += dt;
      if (s.done) return;
      const a = p.a * deg, down = g * Math.sin(a), fr = p.mu * g * Math.cos(a);
      if (s.v === 0 && down <= fr) return;          // трение покоя держит брусок
      s.v += (down - fr) * dt;
      s.x += s.v * dt;
      if (s.x >= p.L) { s.x = p.L; s.done = true; s.stop = 'Брусок у основания плоскости'; }
    },
    readouts(s, p) {
      const a = p.a * deg, acc = Math.max(0, g * Math.sin(a) - p.mu * g * Math.cos(a));
      return [['ускорение', acc, 'м/с²'], ['скорость', s.v, 'м/с'], ['путь', s.x, 'м'],
              ['сила трения', p.mu * p.m * g * Math.cos(a), 'Н']];
    },
    graphs: [
      { label: 'v(t) — скорость', unit: 'м/с', get: s => s.v },
    ],
    draw(d, s, p) {
      const a = p.a * deg, H = p.L * Math.sin(a), B = p.L * Math.cos(a);
      d.ground(-0.4, 0, B + 0.3, 0);
      d.polygon([[0, 0], [B, 0], [0, H]], { color: 'ink2', fill: true });
      d.angle(B, 0, 0.45, Math.PI - a, Math.PI, { label: 'α' });
      // брусок: переносим начало в точку на склоне и поворачиваем вдоль склона
      const cx = s.x * Math.cos(a), cy = H - s.x * Math.sin(a), w = 0.4, h = 0.25;
      d.save();
      d.translate(cx, cy);
      d.rotate(-a);
      d.block(-w / 2, 0, w, h, { color: 'accent', label: 'm' });
      d.restore();
      if (p.forces) {
        const mx = cx + Math.sin(a) * h / 2, my = cy + Math.cos(a) * h / 2, k = 0.6 / (p.m * g);   // mg — стрелка 0,6 м
        const N = p.m * g * Math.cos(a), F = p.mu * N;
        d.force(mx, my, 0, -p.m * g, { kind: 'gravity', scale: k, label: 'mg' });
        d.force(mx, my, N * Math.sin(a), N * Math.cos(a), { kind: 'normal', scale: k, label: 'N' });
        if (F > 0) d.force(mx, my, -F * Math.cos(a), F * Math.sin(a), { kind: 'friction', scale: k, label: 'Fтр' });
      }
    },
    handles(s, p) {
      const a = p.a * deg;
      return [
        { x: 0, y: p.L * Math.sin(a), label: 'угол', drag: (x, y) => ({ a: Math.asin(clamp(y / p.L, 0, 1)) / deg }) },
        { x: p.L * Math.cos(a), y: 0, label: 'длина', drag: (x, y) => ({ L: x / Math.cos(a) }) },
      ];
    },
  });
}
function текстПримера(f){
  const s=f.toString(), тело=s.slice(s.indexOf('{')+1,s.lastIndexOf('}')).replace(/^\n+|\s+$/g,'');
  const отступ=Math.min(...тело.split('\n').filter(l=>l.trim()).map(l=>l.match(/^ */)[0].length));
  return тело.split('\n').map(l=>l.slice(отступ)).join('\n');
}
const ПРИМЕРЫ_МАСТЕРСКОЙ=[
  {id:'ex-pendulum',title:'Маятник с затуханием',f:примерМаятник,что:'ручка у шара, график угла, условное поле'},
  {id:'ex-vessel',title:'Истечение из сосуда',f:примерИстечение,что:'жидкость и струя, две ручки, зонд давления'},
  {id:'ex-incline',title:'Брусок на наклонной плоскости',f:примерБрусок,что:'поворот фигуры, силы, событие-остановка'}
];

/* ---------- Инструкция для ИИ ---------- */
function инструкцияДляИИ(запрос){
  const пр=ПРИМЕРЫ_МАСТЕРСКОЙ.map((x,i)=>`### Пример ${i+1}. ${x.title} (${x.что})\n\n\`\`\`js\n${текстПримера(x.f)}\n\`\`\``).join('\n\n');
  return `# Задание: симуляция для приложения Phy.Sim (формат ${ФОРМАТ_САМОДЕЛЬНЫХ})

Ты пишешь код интерактивной физической симуляции для учебного приложения Phy.Sim. Человек вставит твой код в «Мастерскую» приложения и запустит. Код выполняется в изолированной песочнице: нет страницы, DOM, canvas, сети, таймеров и хранилища. Панель параметров, показания, графики, управление временем, масштаб и инструменты приложение делает само — от тебя нужна только модель по описанному ниже формату.

## Что прислать в ответ

Один блок кода \`\`\`js … \`\`\` целиком, без сокращений и без «…остальное как было». Внутри — ровно один вызов \`simulation({ ... })\`; выше него можно объявить свои константы и функции. Нельзя: import, require, fetch, document, window, canvas, setTimeout, setInterval, Math.random (для случайности есть seeded).

## Каркас

\`\`\`js
simulation({
  title: 'Короткое название',
  params: [ /* параметры, см. ниже */ ],
  presets: [ /* необязательно: готовые наборы */ ],
  view: { x: [xmin, xmax], y: [ymin, ymax] },   // что видно, в метрах; можно функцией p => ({ x: [...], y: [...] })
  init(p) { return { t: 0 /* … состояние … */ }; },
  step(s, dt, p) { /* … */ s.t += dt; },
  readouts(s, p) { return [['название', значение, 'единица']]; },
  graphs: [ { label: 'x(t) — координата', unit: 'м', get: (s, p) => s.x } ],
  draw(d, s, p) { /* рисунок через d, см. ниже */ },
  handles(s, p) { return []; },          // необязательно: ручки, которые тянут мышью
  probe(x, y, s, p) { return null; },    // необязательно: зонд — величины в точке
});
\`\`\`

## Параметры: params

- Число: \`{ key: 'm', label: 'Масса шара', unit: 'кг', min: 0.1, max: 10, step: 0.1, default: 1 }\`
- Флажок: \`{ key: 'air', label: 'Учитывать сопротивление воздуха', type: 'check', default: false }\`
- Выбор: \`{ key: 'mode', label: 'Опыт', type: 'select', options: [{ v: 'free', t: 'Свободное падение' }, { v: 'slope', t: 'По склону' }], default: 'free' }\`
- Заголовок группы: \`{ type: 'group', label: 'Начальные условия' }\`
- Поле видно не всегда: добавь \`if: p => p.air\`.

\`key\` — латиница без пробелов, уникальный. \`p\` — объект со значениями всех параметров: \`p.m\`, \`p.air\`, \`p.mode\`. Пользователь меняет параметр — модель запускается заново: снова вызывается \`init(p)\`. Угол в параметрах удобнее давать в градусах, а в формулах переводить: \`p.a * deg\`. Подбери min, max и default так, чтобы при любых значениях картинка помещалась и формулы не делились на ноль.

\`presets\` — готовые наборы: \`[{ name: 'Что показывает этот набор', values: { m: 2, air: true } }]\`.

## Время: init и step

- \`init(p)\` возвращает состояние \`s\` — обычный объект из чисел, строк, булевых значений и массивов. Обязательно \`s.t = 0\`.
- \`step(s, dt, p)\` продвигает модель на \`dt\` секунд: меняет \`s\` на месте и прибавляет \`s.t += dt\`. По умолчанию dt = 1/240 с; свой шаг — поле \`dt: 1/1000\` в simulation (от 0.00001 до 0.1).
- Интегрируй устойчиво: полу-неявный Эйлер (сначала скорость, потом координата) или \`rk4\`. Не вычисляй всё заново формулой от t, если система этого не позволяет.
- Остановить время на событии (удар, достигли цели, вода кончилась): \`s.stop = 'Шар коснулся земли'\`. Время встанет, сообщение покажется. Одно и то же сообщение второй раз не останавливает, поэтому заведи флаг: \`if (!s.done && условие) { s.done = true; s.stop = '…'; }\`, а после события \`step\` должен только двигать \`s.t\`.
- Неподвижная сцена (геометрия, оптическая схема, поле): \`static: true\` — тогда \`step\` и \`graphs\` не нужны.
- \`step\` должен быть быстрым: меньше 0,5 мс. До ~2000 частиц — нормально.

## Показания и графики

- \`readouts(s, p)\` → массив \`[название, число, единица]\`. Числа не округляй — приложение само форматирует. Вместо числа можно строку ('да', 'нет', 'вверх').
- \`graphs\` — графики по времени. \`get(s, p)\` возвращает число или массив до трёх чисел; для нескольких кривых добавь \`series: ['тело 1', 'тело 2']\`. Не больше 3–4 графиков.
- \`timeUnit: 'мин'\` — если время в модели не в секундах.

## Рисунок: draw(d, s, p)

Мир в метрах (или в своих единицах — тогда поставь \`schema: true\`, и оси без чисел), ось y направлена ВВЕРХ. \`view\` задаёт видимую область. Рисуй только методами \`d\`; координаты и радиусы фигур — в единицах мира, толщина линий \`width\`, размер текста \`size\`, смещения \`dx\`, \`dy\` и размер точек — в пикселях экрана.

Общие настройки \`o\` (последний аргумент, всё необязательно): \`color\` — цвет линии или тела; \`fill: true\` — лёгкая заливка тем же цветом, \`fill: 'имя'\` — сплошная заливка; \`width\` — толщина, px; \`dash: true\` — пунктир; \`alpha\` — прозрачность 0…1; \`label\` — подпись.

Простые фигуры:
- \`d.line(x1, y1, x2, y2, o)\` — отрезок (нить, стержень: \`width: 3\`).
- \`d.path([[x, y], …], o)\` — ломаная; \`o.close: true\` — замкнуть. \`d.polygon(points, o)\` — замкнутый многоугольник.
- \`d.rect(x, y, w, h, o)\` — прямоугольник, (x, y) — левый НИЖНИЙ угол.
- \`d.circle(x, y, r, o)\` — окружность (с \`fill\` — круг).
- \`d.dot(x, y, o)\` — точка размером \`o.size\` px. \`d.particles([[x, y], …], o)\` — много точек сразу (молекулы).
- \`d.trail([[x, y], …], o)\` — след траектории (бледная линия).
- \`d.text(x, y, 'текст', o)\` — текст; \`o.size\`, \`o.align: 'left' | 'center' | 'right'\`, \`o.bold\`, \`o.dx\`, \`o.dy\` (dy > 0 — выше).
- \`d.label(x, y, 'текст', o)\` — подпись у точки; сама уходит от наложений. Для подписей тел и величин лучше она.

Физические предметы:
- \`d.ball(x, y, r, o)\` — шар, тело-точка.
- \`d.block(x, y, w, h, o)\` — брусок, груз, тележка; (x, y) — левый нижний угол; заливка всегда лёгкая, цвета \`o.color\`; \`o.label\` пишется внутри.
- \`d.spring(x1, y1, x2, y2, o)\` — пружина; \`o.coils\` — число витков, \`o.radius\` — полуширина.
- \`d.ground(x1, y1, x2, y2, o)\` — опора со штриховкой справа по ходу: слева направо — штриховка снизу (пол), справа налево — сверху (потолок), снизу вверх — справа (стена).
- \`d.pivot(x, y)\` — шарнир, ось вращения.
- \`d.arrow(x1, y1, x2, y2, o)\` — стрелка (скорость, ускорение, поток); \`o.label\` у острия.
- \`d.force(x, y, Fx, Fy, o)\` — вектор силы из точки (x, y); \`o.scale\` — метров на ньютон (подбери, чтобы самая большая сила была ~1/4 сцены), \`o.kind\`: 'gravity', 'normal', 'friction', 'tension', 'elastic', 'buoyancy' — цвет по виду силы; \`o.label\`.
- \`d.angle(cx, cy, r, a0, a1, o)\` — дуга угла от a0 до a1 (радианы, от оси x против часовой) с подписью \`o.label\`.
- \`d.dimension(x1, y1, x2, y2, 'подпись', o)\` — размерная линия; \`o.offset\` — отступ, px.

Жидкости и тепло:
- \`d.vessel(x0, x1, yBottom, yTop, o)\` — сосуд; \`o.bottom: false\` — без дна (трубка).
- \`d.liquid(x0, y0, x1, y1, o)\` — жидкость в прямоугольнике, y1 — уровень; \`o.kind\`: 'water', 'oil', 'mercury', 'honey', 'blood'; \`o.surface\` — массив высот поверхности по ширине (для кривой поверхности).
- \`d.jet([[x, y], …], ширина, o)\` — струя (ширина в метрах, число или массив по точкам). \`d.drop(x, y, r, o)\` — капля.
- \`d.gas(x, y, w, h, { T, density })\` — газ: оттенок по температуре T, К.
- \`d.cylinder({ x, bottom, width, height, gasHeight, T, heat: 'heat' | 'cool' | 'insulated', molecules: [[0…1, 0…1], …] })\` — цилиндр с поршнем; x — середина.
- \`d.heater(x, y, w, { on, cold })\` — плита нагревателя или холодильника. \`d.thermometer(x, y, h, доля)\`, \`d.gauge(x, y, r, доля)\` — термометр и шкала прибора (доля 0…1).

Поясняющий текст внизу сцены: \`d.caption(['строка 1', ['важная строка', 'danger', true]])\`.

Поворот и сдвиг для наклонных тел: \`d.save(); d.translate(x, y); d.rotate(угол); …фигуры в своих координатах…; d.restore();\` — работает для простых фигур, предметов, стрелок и подписей.

### Цвета — только имена

ink, ink2, ink3 — чернила: основное, вторичное, бледное (контуры, нити, опоры); accent — главное тело; second — второе тело, вода; third — третье; danger — тепло, опасность; ok — «хорошо», равновесие; measure — размеры и измерения; line — бледные вспомогательные линии; canvas — цвет фона (закрыть что-то «дыркой»). Силы — gravity, normal, friction, tension, elastic, buoyancy. Температура — \`{ T: 450 }\` или \`'T:450'\`. Другие цвета («#ff0000», «red») приложение заменит ближайшими из палитры — не пиши их.

### Стиль

Строгий плоский чертёж, как в учебнике: тонкие линии, лёгкие заливки, без теней, бликов, градиентов, «реалистичных» текстур и пламени. Тело — простая фигура. Кроме чернил — 2–3 цвета на сцену. Подписи короткие (буква или «v = 3,2 м/с»). Не перегружай: главное явление должно быть видно сразу. Масштаб: важные предметы не мельче ~1/20 видимой области.

## Ручки: handles(s, p)

Квадратные ручки на рисунке, которые человек тянет мышью или пальцем; при этом меняются параметры. Возвращают массив:
\`{ x, y, label: 'подсказка', drag(x, y, p) { return { ключ: новоеЗначение }; } }\`
\`(x, y)\` — где ручка сейчас (обычно точка, которую задаёт параметр: начальное положение тела, уровень, конец нити); \`drag\` получает координаты указателя в мире и возвращает новые значения параметров (приложение само обрежет их до min…max и шага). Сделай 1–3 ручки на самое важное.

## Зонд: probe(x, y, s, p)

Человек щёлкает в точку сцены — покажи местные величины: массив коротких строк (до 6) или \`null\`, если там мерить нечего. Например, давление на глубине, скорость потока, поле в точке.

## Помощники (уже объявлены)

\`deg\` = π/180; \`g\` = 9.81; \`clamp(x, a, b)\`; \`lerp(a, b, k)\`; \`rk4(f, y, t, dt)\` — шаг Рунге — Кутты, где \`f(t, y)\` возвращает массив производных, \`y\` — массив; \`seeded(42)\` — генератор случайных чисел (вызов возвращает число от 0 до 1; одинаковое зерно — одинаковая картина).

## Перед ответом проверь себя

1. Физика верная, единицы СИ (или указаны в unit), знаки и направления осей согласованы с картинкой (y вверх).
2. При крайних значениях всех параметров (min и max) нет деления на ноль, корня из отрицательного, NaN; сцена помещается во view.
3. \`s.t\` растёт в step; событие останавливает время один раз.
4. Каждый параметр на что-то влияет, каждое показание считается из состояния.
5. Рисунок строгий: имена цветов из палитры, ничего лишнего.

## Примеры

${пр}

## Что нужно сделать

${(запрос||'').trim()||'(опишите здесь, какую симуляцию сделать: явление, что менять, что показывать)'}
`;
}

/* ---------- Хранилище ---------- */
const МАСТ={вкладка:'list', текущая:null, отчёты:{}, поток:{}};
function мастСписок(){ const l=LS.get('workshop',[]); return Array.isArray(l)?l.filter(x=>x&&x.id):[]; }
function мастЗаписать(список){ LS.set('workshop',список); }
function мастНайти(id){ return мастСписок().find(x=>x.id===id)||null; }
function мастОбновить(id,изм){
  const л=мастСписок(), i=л.findIndex(x=>x.id===id); if(i<0) return null;
  л[i]=Object.assign({},л[i],изм,{updated:Date.now()}); мастЗаписать(л); return л[i];
}
function мастНовая(поля){
  const з=Object.assign({id:'u'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),title:'Новая симуляция',request:'',code:'',
    format:ФОРМАТ_САМОДЕЛЬНЫХ,created:Date.now(),updated:Date.now(),check:null},поля||{});
  const л=мастСписок(); л.unshift(з); мастЗаписать(л); return з;
}
function мастЗаголовок(код){
  const m=/title\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/.exec(очиститьКодИИ(код)||''); return m?m[2].slice(0,90):null;
}

/* ---------- Отчёт проверки ---------- */
function мастОшибкаСтрокой(e){
  return `${e.где?e.где:'код'}${e.line?', строка '+e.line:''}: ${e.msg}${e.набор?` (параметры: ${e.набор})`:''}`;
}
function мастОтчётДляИИ(запись,отчёт,замечание){
  const код=очиститьКодИИ(запись.code), строки=код.split('\n');
  const кусок=L=>{ if(!L) return ''; const a=Math.max(1,L-2), b=Math.min(строки.length,L+2), out=[];
    for(let i=a;i<=b;i++) out.push(`${i===L?'>':' '} ${String(i).padStart(3)} | ${строки[i-1]}`); return '\n```\n'+out.join('\n')+'\n```'; };
  const ош=(отчёт.ошибки||[]), пр=(отчёт.предупреждения||[]);
  let т=`Симуляция для Phy.Sim${отчёт.мета?` «${отчёт.мета.title}»`:''} не прошла автоматическую проверку. Исправь код по инструкции формата ${ФОРМАТ_САМОДЕЛЬНЫХ} и пришли его целиком одним блоком \`\`\`js.\n`;
  if(!ош.length&&!пр.length) т=`Симуляция для Phy.Sim${отчёт.мета?` «${отчёт.мета.title}»`:''} проходит проверку. Доработай её, как описано ниже, и пришли код целиком одним блоком \`\`\`js.\n`;
  if(ош.length) т+=`\nОшибки (${ош.length}):\n`+ош.map((e,i)=>`${i+1}. ${мастОшибкаСтрокой(e)}${e.params?`\n   значения: ${JSON.stringify(e.params)}`:''}${кусок(e.line)}`).join('\n');
  if(пр.length) т+=`\n\nПредупреждения (${пр.length}):\n`+пр.map((e,i)=>`${i+1}. ${мастОшибкаСтрокой(e)}`).join('\n');
  if(замечание&&замечание.trim()) т+=`\n\nЗамечания от меня:\n${замечание.trim()}`;
  return т;
}

/* ---------- Окно Мастерской ---------- */
const ВКЛАДКИ_МАСТ=[['list','Мои симуляции'],['edit','Редактор'],['guide','Инструкция для ИИ']];
const ЗНАЧОК_МАСТ='<svg viewBox="0 0 24 24"><path d="M14.5 5.5l4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M13 7l4 4"/></svg>';
function собратьМастерскую(){
  let p=document.getElementById('workshop'); if(p) return p;
  p=document.createElement('div'); p.id='workshop'; p.className='path wk hidden';
  p.setAttribute('role','dialog'); p.setAttribute('aria-label','Мастерская');
  p.innerHTML=`<div class="path-box">
    <div class="path-h">
      <div class="path-title">${ЗНАЧОК_МАСТ}Мастерская</div>
      <div class="path-tabs" role="tablist">${ВКЛАДКИ_МАСТ.map(([id,имя])=>`<button role="tab" data-wt="${id}">${имя}</button>`).join('')}<i class="path-ink"></i></div>
      <button class="iconbtn path-x" title="Закрыть (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="path-body wk-body" id="wk-body"></div></div>`;
  document.body.append(p);
  p.querySelector('.path-x').onclick=закрытьМастерскую;
  p.addEventListener('pointerdown',e=>{ if(e.target===p) закрытьМастерскую(); });
  p.querySelectorAll('[data-wt]').forEach(b=>b.onclick=()=>вкладкаМастерской(b.dataset.wt));
  p.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); закрытьМастерскую(); } e.stopPropagation(); });
  return p;
}
function открытьМастерскую(вкладка,id){
  const p=собратьМастерскую();
  if(id) МАСТ.текущая=id;
  p.classList.remove('hidden'); document.documentElement.classList.add('wk-on');
  if(typeof закрытьПуть==='function'&&typeof путьОткрыт==='function'&&путьОткрыт()) закрытьПуть();
  вкладкаМастерской(вкладка||МАСТ.вкладка);
}
function закрытьМастерскую(){
  const p=document.getElementById('workshop'); if(!p) return;
  p.classList.add('hidden'); document.documentElement.classList.remove('wk-on');
}
const мастерскаяОткрыта=()=>{ const p=document.getElementById('workshop'); return !!p&&!p.classList.contains('hidden'); };
function вкладкаМастерской(id){
  if(id==='edit'&&!(МАСТ.текущая&&мастНайти(МАСТ.текущая))) id='list';
  МАСТ.вкладка=id;
  const p=собратьМастерскую(), body=p.querySelector('#wk-body');
  p.querySelectorAll('[data-wt]').forEach(b=>{ const on=b.dataset.wt===id; b.classList.toggle('on',on); b.setAttribute('aria-selected',on?'true':'false');
    if(b.dataset.wt==='edit') b.classList.toggle('hidden',!(МАСТ.текущая&&мастНайти(МАСТ.текущая))); });
  const on=p.querySelector('[data-wt].on'), ink=p.querySelector('.path-ink');
  if(on&&ink){ ink.style.width=on.offsetWidth+'px'; ink.style.transform=`translateX(${on.offsetLeft}px)`; }
  body.scrollTop=0; body.innerHTML='';
  ({list:рисоватьСписокМаст,edit:рисоватьРедакторМаст,guide:рисоватьИнструкциюМаст})[id](body);
}
const мастДата=t=>{ try{ return new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+', '+new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } };
function мастСтатус(з){
  if(!з.code||!з.code.trim()) return '<span class="wk-st">нет кода</span>';
  if(!з.check) return '<span class="wk-st">не проверена</span>';
  if(з.check.ошибок) return `<span class="wk-st bad">ошибок: ${з.check.ошибок}</span>`;
  return `<span class="wk-st good">проверена${з.check.предупреждений?` · замечаний: ${з.check.предупреждений}`:''}</span>`;
}
function рисоватьСписокМаст(body){
  const л=мастСписок();
  body.innerHTML=`
    <section class="wk-how">
      <div class="wk-steps">
        <div><b>1</b><span>Опишите словами, какое явление показать и что в нём менять.</span></div>
        <div><b>2</b><span>Скопируйте задание и отправьте любому ИИ — ChatGPT, Claude, DeepSeek, GigaChat.</span></div>
        <div><b>3</b><span>Вставьте ответ, нажмите «Проверить» и «Запустить». Ошибки — одной кнопкой обратно в ИИ.</span></div>
      </div>
      <div class="wk-acts"><button class="btn primary" id="wk-new">Новая симуляция</button><button class="btn" id="wk-paste">Вставить готовый код</button>
        <label class="btn wk-file">Открыть файл<input type="file" id="wk-file" accept=".js,.txt,text/javascript,text/plain" hidden></label></div>
    </section>
    <h3 class="wk-h">Мои симуляции</h3>
    ${л.length?`<div class="wk-grid">${л.map(з=>`<div class="wk-card" data-id="${esc(з.id)}">
        <b>${esc(з.title||'Без названия')}</b><span>${мастДата(з.updated)} · ${мастСтатус(з)}</span>
        ${з.request?`<p>${esc(з.request.slice(0,140))}${з.request.length>140?'…':''}</p>`:''}
        <div class="wk-row"><button class="btn primary" data-act="run"${з.code&&з.code.trim()?'':' disabled'}>Запустить</button><button class="btn" data-act="edit">Править</button>
          <button class="btn ghost" data-act="copy" title="Скопировать код — чтобы отправить другу">Код</button><button class="btn ghost" data-act="file" title="Скачать файл .js">Файл</button>
          <button class="btn ghost" data-act="del" title="Удалить">Удалить</button></div></div>`).join('')}</div>`
      :`<p class="wk-empty">Пока пусто. Начните с «Новой симуляции» или посмотрите примеры ниже — это те же примеры, что ИИ видит в инструкции.</p>`}
    <h3 class="wk-h">Примеры</h3>
    <div class="wk-grid">${ПРИМЕРЫ_МАСТЕРСКОЙ.map(x=>`<div class="wk-card wk-ex" data-ex="${x.id}"><b>${esc(x.title)}</b><span>${esc(x.что)}</span>
      <div class="wk-row"><button class="btn primary" data-act="run">Запустить</button><button class="btn" data-act="copy">Сделать копию</button></div></div>`).join('')}</div>
    <p class="wk-note">Самодельные симуляции хранятся только на этом устройстве. Чтобы перенести или поделиться — «Код» или «Файл», а на другом устройстве «Вставить готовый код». Модель выполняется в песочнице: ей недоступны ваши заметки, прогресс и сеть.</p>`;
  body.querySelector('#wk-new').onclick=()=>{ const з=мастНовая(); МАСТ.текущая=з.id; вкладкаМастерской('edit'); setTimeout(()=>{ const t=document.getElementById('wk-req'); if(t) t.focus(); },60); };
  body.querySelector('#wk-paste').onclick=()=>{ const з=мастНовая({title:'Вставленный код'}); МАСТ.текущая=з.id; вкладкаМастерской('edit'); setTimeout(()=>{ const t=document.getElementById('wk-code'); if(t) t.focus(); },60); };
  const ф=body.querySelector('#wk-file');
  ф.onchange=()=>{ const f=ф.files&&ф.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ const код=String(r.result||''); const з=мастНовая({title:мастЗаголовок(код)||f.name.replace(/\.[^.]+$/,''),code:код}); МАСТ.текущая=з.id; вкладкаМастерской('edit'); toast('Файл открыт — проверьте и запустите'); };
    r.readAsText(f); };
  body.querySelectorAll('.wk-card[data-id]').forEach(card=>{ const id=card.dataset.id;
    card.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{ const з=мастНайти(id); if(!з) return;
      const act=b.dataset.act;
      if(act==='run') запуститьИзМастерской(з);
      else if(act==='edit'){ МАСТ.текущая=id; вкладкаМастерской('edit'); }
      else if(act==='copy'){ copyText(мастФайл(з)); toast('Код скопирован — его можно вставить в Мастерскую на другом устройстве'); }
      else if(act==='file'){ скачать(мастИмяФайла(з),new Blob([мастФайл(з)],{type:'text/javascript'})); }
      else if(act==='del') askConfirm(`Удалить «${з.title}»? Код пропадёт с этого устройства.`,()=>{ мастЗаписать(мастСписок().filter(x=>x.id!==id)); if(МАСТ.текущая===id) МАСТ.текущая=null; рисоватьСписокМаст(body); },'Удалить симуляцию',{ok:'Удалить'});
    }); });
  body.querySelectorAll('.wk-card[data-ex]').forEach(card=>{ const x=ПРИМЕРЫ_МАСТЕРСКОЙ.find(q=>q.id===card.dataset.ex);
    card.querySelector('[data-act="run"]').onclick=()=>запуститьИзМастерской({id:x.id,title:x.title,code:текстПримера(x.f),пример:true});
    card.querySelector('[data-act="copy"]').onclick=()=>{ const з=мастНовая({title:x.title,code:текстПримера(x.f),request:'Пример из инструкции: '+x.title}); МАСТ.текущая=з.id; вкладкаМастерской('edit'); toast('Копия создана — её можно править'); }; });
}
function мастИмяФайла(з){ return (String(з.title||'симуляция').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,60)||'симуляция')+'.physim.js'; }
function мастФайл(з){
  const код=очиститьКодИИ(з.code);
  return `// Phy.Sim — самодельная симуляция, формат ${ФОРМАТ_САМОДЕЛЬНЫХ}. Открыть: Мастерская → «Вставить готовый код» или «Открыть файл».\n`+
    (з.request?з.request.split('\n').map(l=>'// '+l).join('\n')+'\n':'')+код+'\n';
}
function рисоватьРедакторМаст(body){
  const з=мастНайти(МАСТ.текущая); if(!з){ вкладкаМастерской('list'); return; }
  const отчёт=МАСТ.отчёты[з.id]||null;
  body.innerHTML=`
    <div class="wk-ed">
      <section class="wk-sec">
        <div class="wk-sh"><b>1</b><span>Что должна показывать симуляция</span></div>
        <textarea id="wk-req" class="wk-ta" rows="5" placeholder="Например: шар бросают под углом к горизонту с учётом сопротивления воздуха. Менять: скорость, угол, массу, коэффициент сопротивления. Показывать траекторию с сопротивлением и без, дальность и высоту, графики скоростей vx и vy. Ручка — направление и величина начальной скорости.">${esc(з.request||'')}</textarea>
        <div class="wk-row"><button class="btn primary" id="wk-copy-task">Скопировать задание для ИИ</button>
          <span class="wk-hint">Инструкция и ваше описание — одним текстом. Вставьте в чат с ИИ и отправьте.</span></div>
      </section>
      <section class="wk-sec">
        <div class="wk-sh"><b>2</b><span>Ответ ИИ — код симуляции</span><span class="wk-saved" id="wk-saved"></span></div>
        <textarea id="wk-code" class="wk-ta wk-code" rows="16" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="Вставьте сюда ответ ИИ целиком — блок кода найдётся сам">${esc(з.code||'')}</textarea>
        <div class="wk-row"><button class="btn" id="wk-check">Проверить</button><button class="btn primary" id="wk-run">Запустить</button>
          <span class="wk-hint">Проверка гоняет модель на разных параметрах и ищет ошибки, NaN и зависания.</span></div>
      </section>
      <section class="wk-sec" id="wk-report">${отчёт?отчётHTML(з,отчёт):''}</section>
    </div>`;
  const req=body.querySelector('#wk-req'), code=body.querySelector('#wk-code'), saved=body.querySelector('#wk-saved');
  let таймер=0;
  const сохранить=()=>{ clearTimeout(таймер); таймер=setTimeout(()=>{ const t=мастЗаголовок(code.value);
    мастОбновить(з.id,{request:req.value,code:code.value,title:t||(з.title==='Новая симуляция'&&req.value.trim()?req.value.trim().split(/[.\n]/)[0].slice(0,60):з.title)});
    saved.textContent='сохранено'; setTimeout(()=>{ saved.textContent=''; },1200); },350); };
  req.oninput=сохранить; code.oninput=()=>{ delete МАСТ.отчёты[з.id]; сохранить(); };
  body.querySelector('#wk-copy-task').onclick=()=>{ мастОбновить(з.id,{request:req.value});
    if(!req.value.trim()){ toast('Сначала опишите, что должна показывать симуляция'); req.focus(); return; }
    copyText(инструкцияДляИИ(req.value)); toast('Задание скопировано — вставьте его в чат с ИИ'); };
  body.querySelector('#wk-check').onclick=()=>мастПроверить(з.id,code.value);
  body.querySelector('#wk-run').onclick=()=>{ мастОбновить(з.id,{code:code.value,request:req.value,title:мастЗаголовок(code.value)||з.title}); запуститьИзМастерской(мастНайти(з.id)); };
  привязатьОтчёт(body,з);
}
function отчётHTML(з,о){
  if(о.идёт) return `<div class="wk-rep"><div class="wk-rep-h">Проверяю модель…</div></div>`;
  const ош=о.ошибки||[], пр=о.предупреждения||[];
  const заг=ош.length?`<div class="wk-rep-h bad">Найдено ошибок: ${ош.length}</div>`
    :`<div class="wk-rep-h good">Проверка пройдена${о.наборов?`: ${о.наборов} ${plural(о.наборов,'набор','набора','наборов').replace(/^\d+\s/,'')} параметров`:''}${о.мсШаг?`, шаг модели ${о.мсШаг<0.01?(о.мсШаг*1000).toFixed(1)+' мкс':о.мсШаг.toFixed(2)+' мс'}`:''}</div>`;
  const пункт=(e,кл)=>`<li class="${кл}"><b>${esc(e.где||'код')}${e.line?`, строка ${e.line}`:''}</b> — ${esc(e.msg)}${e.набор?` <small>(${esc(e.набор)})</small>`:''}</li>`;
  return `<div class="wk-rep">${заг}
    ${ош.length?`<ul class="wk-list">${ош.map(e=>пункт(e,'bad')).join('')}</ul>`:''}
    ${пр.length?`<div class="wk-sub">Замечания</div><ul class="wk-list">${пр.map(e=>пункт(e,'warn')).join('')}</ul>`:''}
    <div class="wk-sub">Что ещё поправить — по желанию</div>
    <textarea id="wk-note" class="wk-ta" rows="2" placeholder="Например: шар слишком мелкий; добавь график энергии; трение должно зависеть от скорости">${esc(з.note||'')}</textarea>
    <div class="wk-row"><button class="btn${ош.length||пр.length?' primary':''}" id="wk-copy-rep">${ош.length||пр.length?'Скопировать отчёт для ИИ':'Скопировать замечания для ИИ'}</button>
      <span class="wk-hint">Отправьте в тот же чат — ИИ пришлёт исправленный код.</span></div></div>`;
}
function привязатьОтчёт(body,з){
  const b=body.querySelector('#wk-copy-rep'); if(!b) return;
  const n=body.querySelector('#wk-note');
  if(n) n.oninput=()=>мастОбновить(з.id,{note:n.value});
  b.onclick=()=>{ const о=МАСТ.отчёты[з.id]; if(!о) return; copyText(мастОтчётДляИИ(мастНайти(з.id)||з,о,n?n.value:'')); toast('Отчёт скопирован — отправьте его ИИ'); };
}
function мастПроверить(id,код){
  мастОбновить(id,{code:код,title:мастЗаголовок(код)||(мастНайти(id)||{}).title});
  МАСТ.отчёты[id]={идёт:true};
  const перерисовать=()=>{ const box=document.getElementById('wk-report'); const з=мастНайти(id);
    if(box&&з&&МАСТ.текущая===id){ box.innerHTML=отчётHTML(з,МАСТ.отчёты[id]); привязатьОтчёт(box,з); } };
  перерисовать();
  if(!очиститьКодИИ(код)){ МАСТ.отчёты[id]={ошибки:[{где:'код',msg:'код пуст — вставьте ответ ИИ'}],предупреждения:[]}; перерисовать(); return Promise.resolve(МАСТ.отчёты[id]); }
  return проверитьКод(код).then(о=>{
    МАСТ.отчёты[id]=о;
    мастОбновить(id,{check:{ошибок:(о.ошибки||[]).length,предупреждений:(о.предупреждения||[]).length,at:Date.now()}});
    перерисовать(); return о;
  });
}

function рисоватьИнструкциюМаст(body){
  const т=инструкцияДляИИ('');
  body.innerHTML=`<div class="wk-guide">
    <p class="wk-note">Это текст, который ИИ получает вместе с вашим описанием: формат модели, методы рисования, палитра, стиль и три рабочих примера (их можно запустить на вкладке «Мои симуляции»). Обычно копировать его отдельно не нужно — кнопка «Скопировать задание для ИИ» в редакторе кладёт инструкцию и описание одним текстом.</p>
    <div class="wk-row"><button class="btn" id="wk-copy-guide">Скопировать инструкцию</button><span class="wk-hint">формат ${ФОРМАТ_САМОДЕЛЬНЫХ} · ${т.length.toLocaleString('ru-RU')} знаков</span></div>
    <pre class="wk-pre">${esc(т)}</pre></div>`;
  body.querySelector('#wk-copy-guide').onclick=()=>{ copyText(т); toast('Инструкция скопирована'); };
}

/* ---------- Запуск ---------- */
function запуститьИзМастерской(з){
  if(!з||!очиститьКодИИ(з.code)){ toast('Нет кода — вставьте ответ ИИ'); return Promise.resolve(false); }
  const id='my-'+з.id;
  const п=создатьПоток(з.code);
  toast('Запускаю…');
  return п.готов.then(()=>{
    if(SIMS[id]&&SIMS[id].отключить) SIMS[id].отключить();
    delete RT[id];
    SIMS[id]=определениеСамодельной(id,з,п);
    закрытьМастерскую();
    if(typeof закрытьГлавную==='function') try{ закрытьГлавную(); }catch(_){}
    /* в шапке сцены — список симуляций темы; у самодельной темы нет,
       поэтому в списке одна она сама */
    const sel=document.getElementById('simsel');
    if(sel){ sel.innerHTML=`<option value="${id}">${esc(SIMS[id].title)}</option>`; sel.style.display=''; sel.onchange=e=>openSim(e.target.value); }
    if(typeof fillSimPick==='function') fillSimPick([id]);
    openSim(id);
    if(typeof isNarrow==='function'&&isNarrow()&&typeof openSimMobile==='function') try{ openSimMobile(); }catch(_){}
    обновитьМенюМастерской();
    return true;
  },отказ=>{
    const о=Object.assign({наборов:0},отказ);
    if(з.пример){ toast('Пример не запустился: '+((о.ошибки||[])[0]||{}).msg); return false; }
    МАСТ.отчёты[з.id]=о; мастОбновить(з.id,{check:{ошибок:(о.ошибки||[]).length,предупреждений:(о.предупреждения||[]).length,at:Date.now()}});
    МАСТ.текущая=з.id; открытьМастерскую('edit');
    toast('Код не запустился — ошибки в отчёте');
    return false;
  });
}
/* «Править в Мастерской» — в меню сцены, только у самодельных */
function обновитьМенюМастерской(){
  const a=A(), b=document.getElementById('mi-wk-edit');
  if(b) b.classList.toggle('hidden',!(a&&a.def.самодельная&&a.def.запись&&!a.def.запись.пример));
}
function правитьТекущую(){
  const a=A(); if(!a||!a.def.самодельная) return;
  const з=a.def.запись; if(з.пример){ открытьМастерскую('list'); return; }
  МАСТ.текущая=з.id; открытьМастерскую('edit');
}

/* ---------- Кнопки входа ---------- */
(function(){
  const b=document.getElementById('btn-workshop'); if(b) b.onclick=()=>мастерскаяОткрыта()?закрытьМастерскую():открытьМастерскую();
  const d=document.getElementById('d-workshop'); if(d) d.onclick=()=>{ if(typeof drawer==='function') drawer(false); открытьМастерскую(); };
  const mi=document.getElementById('mi-workshop'); if(mi) mi.onclick=()=>{ const pm=document.getElementById('pop-simmenu'); if(pm) pm.classList.add('hidden'); открытьМастерскую(); };
  const me=document.getElementById('mi-wk-edit'); if(me) me.onclick=()=>{ const pm=document.getElementById('pop-simmenu'); if(pm) pm.classList.add('hidden'); правитьТекущую(); };
  if(typeof CMDS!=='undefined'){
    CMDS.push({k:'Мастерская',t:'Мастерская: своя симуляция с помощью ИИ',run:()=>открытьМастерскую('list')});
    CMDS.push({k:'Мастерская',t:'Новая самодельная симуляция',run:()=>{ const з=мастНовая(); МАСТ.текущая=з.id; открытьМастерскую('edit'); }});
    CMDS.push({k:'Мастерская',t:'Скопировать инструкцию для ИИ',run:()=>{ copyText(инструкцияДляИИ('')); toast('Инструкция скопирована'); }});
  }
})();
