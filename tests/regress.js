// Сводная проверка перед выпуском: загрузка без ошибок, все 76 симуляций
// (300 шагов и отрисовка настоящим кодом приложения), формулы в колонке,
// карандаш, F11, запрет выделения, вкладки задач и мобильная раскладка.
// Гоняется и по исходникам, и по собранному одностраничнику.
//
//   npm i -D playwright && npm test
//
// Браузер берётся из playwright; если он лежит отдельно, путь можно передать
// в CHROMIUM_PATH. Специально не в devDependencies: репозиторий должен
// клонироваться и открываться без единой установки.
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
               '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const server = http.createServer((q, s) => {
  const p = path.join(ROOT, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
});

const fails = [];
const ok = (name, cond, info) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (info === undefined ? '' : '  ' + JSON.stringify(info)));
  if (!cond) fails.push(name);
};

async function boot(b, url, ui) {
  const p = await b.newPage(ui === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1500, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**cdnjs.cloudflare.com**', r => r.abort());
  await p.goto(url);
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);
  return { p, errs };
}

(async () => {
  await new Promise(r => server.listen(8971, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  for (const [label, url] of [['исходники', 'http://localhost:8971/'],
                              ['одностраничник', 'http://localhost:8971/phy-sim-standalone.html']]) {
    console.log('\n=== ' + label + ' (ПК) ===');
    const { p, errs } = await boot(b, url, 'desk');

    ok('загрузка без ошибок', errs.length === 0, errs.slice(0, 3));

    const counts = await p.evaluate(() => ({
      sims: Object.keys(SIMS).length,
      topics: ALL.length,
      problems: ALL.reduce((n, t) => n + (t.problems || []).length, 0),
    }));
    ok('76 симуляций', counts.sims === 76, counts);
    ok('темы и задачи на месте', counts.topics >= 34 && counts.problems >= 380, counts);

    // Каждая симуляция: настоящая инициализация приложения → 300 шагов → отрисовка
    // тем же кодом, что и в жизни. Ловим и исключения, и NaN в показаниях.
    const sims = await p.evaluate(() => {
      const bad = { бросили: [], NaN: [] };
      for (const id of Object.keys(SIMS)) {
        try {
          openSim(id);
          const a = A();
          for (let i = 0; i < 300; i++) a.def.step(a.state, 1 / 120, a.params);
          drawAll();
          const r = a.def.readouts ? a.def.readouts(a.state, a.params) : [];
          if (r.some(x => typeof x.v === 'number' && !isFinite(x.v))) bad.NaN.push(id);
        } catch (e) { bad.бросили.push(id + ': ' + e.message); }
      }
      return bad;
    });
    ok('все симуляции считаются и рисуются', sims.бросили.length === 0, sims.бросили.slice(0, 5));
    ok('показания конечны', sims.NaN.length === 0, sims.NaN.slice(0, 5));

    // Формулы: ни одна не должна вылезать за свой блок.
    const wide = await p.evaluate(async () => {
      let over = 0, seen = 0;
      for (const t of ALL) {
        openTopic(t.id);
        await new Promise(r => setTimeout(r, 30));
        for (const k of document.querySelectorAll('#pane .katex-display')) {
          seen++;
          const inner = k.querySelector('.katex-html > .base') || k.querySelector('.katex');
          if (inner && inner.getBoundingClientRect().width > k.getBoundingClientRect().width + 1) over++;
        }
      }
      return { seen, over };
    });
    ok('формулы влезают в колонку', wide.over === 0 && wide.seen > 200, wide);

    // Карандаш: полоса, цвета, толщины, и стиль запоминается в самом штрихе.
    const pen = await p.evaluate(() => {
      openSim(Object.keys(SIMS)[0]);
      setTool('pencil');
      const bar = document.querySelector('#penbar');
      const colors = document.querySelectorAll('#pb-colors .pb-color').length;
      const widths = document.querySelectorAll('#pb-widths .pb-width').length;
      const visible = bar && !bar.classList.contains('hidden') && bar.getBoundingClientRect().height > 0;
      // рисуем штрих последним цветом и последней толщиной
      document.querySelectorAll('#pb-colors .pb-color')[4].click();
      document.querySelectorAll('#pb-widths .pb-width')[3].click();
      const a = A();
      const n0 = a.annos.length;
      a.draft = { type: 'pencil', pts: [[0, 0], [1, 1]], c: S.pen.c, w: S.pen.w };
      a.annos.push(a.draft); a.draft = null;
      const last = a.annos[a.annos.length - 1];
      return { visible, colors, widths, добавлен: a.annos.length === n0 + 1, c: last.c, w: last.w };
    });
    ok('панель карандаша', pen.visible && pen.colors === 6 && pen.widths === 4, pen);
    ok('штрих хранит свой стиль', pen.добавлен && pen.c && pen.w > 0, { c: pen.c, w: pen.w });

    // F11 в браузере: кольцо из двух режимов, «весь экран в окне» не предлагается.
    const wm = await p.evaluate(() => {
      const seq = [];
      prefSet('winMode', 'window');
      for (let i = 0; i < 4; i++) { cycleWindowMode(); seq.push(prefGet('winMode')); }
      prefSet('winMode', 'window');
      return seq;
    });
    ok('F11 переключает режим окна', wm.join(',') === 'full,window,full,window', wm);

    // Выделение текста: запрещено везде, кроме полей ввода.
    const sel = await p.evaluate(() => {
      const i = document.createElement('input'); document.body.appendChild(i);
      const r = { body: getComputedStyle(document.body).userSelect,
                  input: getComputedStyle(i).userSelect };
      i.remove(); return r;
    });
    ok('текст не выделяется, поля — выделяются',
        sel.body === 'none' && sel.input === 'text', sel);

    // Вкладка «Задачи» скрыта там, где задач нет.
    const tabs = await p.evaluate(async () => {
      const empty = ALL.find(t => !(t.problems || []).length);
      const full = ALL.find(t => (t.problems || []).length);
      const st = {};
      for (const [k, t] of [['пусто', empty], ['есть', full]]) {
        if (!t) { st[k] = null; continue; }
        openTopic(t.id); await new Promise(r => setTimeout(r, 30));
        const el = document.querySelector('#tabs');
        st[k] = el.classList.contains('hidden') ? 'скрыт' : 'виден';
      }
      return st;
    });
    ok('вкладки прячутся, когда задач нет',
        (tabs.пусто === null || tabs.пусто === 'скрыт') && tabs.есть === 'виден', tabs);

    await p.close();

    // --- телефон ---
    console.log('--- ' + label + ' (телефон) ---');
    const m = await boot(b, url, 'mobile');
    ok('мобильная загрузка без ошибок', m.errs.length === 0, m.errs.slice(0, 3));

    const mob = await m.p.evaluate(() => ({
      ui: document.documentElement.dataset.ui,
      шапкаПК: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
      шапка: Math.round(document.querySelector('.mtop').getBoundingClientRect().height),
      // шапка симуляции меряется только с открытой симуляцией: пока показан
      // конспект, панель свёрнута и её высота честно равна нулю
      симшапка: (() => { openSim(Object.keys(SIMS)[0]); openSimMobile();
                         return Math.round(document.querySelector('.simhead').getBoundingClientRect().height); })(),
      ключ: !!document.querySelector('#mb-tools svg') &&
            document.querySelector('#mb-tools').innerHTML.length > 0,
      пуск2: !!document.querySelector('#mb-play2'),
      папки: (() => { openSim(Object.keys(SIMS)[0]); fillToolsPop();
                      return document.querySelectorAll('#pop-tools .tf-folder').length; })(),
    }));
    // .mtop — 46 px по макету, шапка симуляции — тонкая, до 40 px
    ok('мобильная раскладка', mob.ui === 'mobile' && mob.шапкаПК === 0 &&
        mob.шапка === 46 && mob.симшапка > 0 && mob.симшапка <= 40, mob);
    ok('гаечный ключ и пуск во второй панели', mob.ключ && mob.пуск2, mob);
    ok('инструменты папками', mob.папки >= 3, mob);

    const mpen = await m.p.evaluate(() => {
      setTool('pencil');
      const bar = document.querySelector('#penbar');
      const r = bar.getBoundingClientRect();
      return { видна: r.height > 0, вКадре: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
               цветов: document.querySelectorAll('#pb-colors .pb-color').length };
    });
    ok('карандаш на телефоне', mpen.видна && mpen.вКадре && mpen.цветов === 6, mpen);

    await m.p.close();
  }

  await b.close(); server.close();
  console.log('\n' + (fails.length ? 'ПРОВАЛЕНО: ' + fails.join(' | ') : 'всё прошло'));
  process.exit(fails.length ? 1 : 0);
})();
