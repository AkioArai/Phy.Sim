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

    /* Инструменты: полоса настроек, клики по ней НАСТОЯЩЕЙ мышью и рисование
       по холсту. Программный .click() здесь не годится: он не проходит
       hit-testing и не зависит от захвата указателя, поэтому пропускал баг,
       из-за которого на компьютере цвет карандаша не переключался вовсе. */
    await p.evaluate(() => { openSim('kin1d'); setTool('pencil'); });
    await p.waitForTimeout(200);

    const bar = await p.evaluate(() => {
      const b = document.querySelector('#penbar');
      const c = document.querySelectorAll('#pb-colors .pb-color');
      const w = document.querySelectorAll('#pb-widths .pb-width');
      const r = k => { const q = k.getBoundingClientRect();
        return [Math.round(q.left + q.width / 2), Math.round(q.top + q.height / 2)]; };
      return { видна: !b.classList.contains('hidden') && b.getBoundingClientRect().height > 0,
               цветов: c.length, толщин: w.length, цвет: r(c[4]), толщина: r(w[3]) };
    });
    ok('полоса настроек инструмента', bar.видна && bar.цветов === 6 && bar.толщин === 4, bar);

    await p.mouse.click(bar.цвет[0], bar.цвет[1]);
    await p.mouse.click(bar.толщина[0], bar.толщина[1]);
    await p.waitForTimeout(150);
    const style = await p.evaluate(() => markStyle('pencil'));
    ok('клик мышью по полосе меняет стиль', style.c === '--ok' && style.w === 6, style);

    const scene = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect();
      return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; });
    await p.mouse.move(scene.cx - 60, scene.cy - 30); await p.mouse.down();
    for (const d of [20, 40, 60, 80]) { await p.mouse.move(scene.cx - 60 + d, scene.cy - 30 + d / 2); }
    await p.mouse.up(); await p.waitForTimeout(150);
    const drawn = await p.evaluate(() => { const a = A(), l = a.annos[a.annos.length - 1];
      return { всего: a.annos.length, тип: l && l.type, c: l && l.c, w: l && l.w }; });
    ok('карандаш рисует по холсту выбранным стилем',
        drawn.всего === 1 && drawn.тип === 'pencil' && drawn.c === '--ok' && drawn.w === 6, drawn);

    // Полоса не должна накрывать шапки плавающих панелей — иначе их не схватить.
    const hud = await p.evaluate(() => {
      const r = document.querySelector('#hud .fp-head').getBoundingClientRect();
      const c = [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
      const top = document.elementFromPoint(c[0], c[1]);
      return { свободна: !!(top && top.closest('#hud .fp-head')),
               накрыта: top ? (top.id || top.className) : 'ничего' };
    });
    ok('полоса не накрывает шапку панели показателей', hud.свободна, hud);

    // Настройки положены каждому рисующему инструменту, а не одному карандашу.
    const tools = await p.evaluate(async () => {
      const r = {};
      for (const t of ['ruler','vector','dim','circle','angle','area','note','guide','pan','probe']) {
        setTool(t); await new Promise(z => setTimeout(z, 15));
        r[t] = { полоса: !document.querySelector('#penbar').classList.contains('hidden'),
                 пунктир: document.querySelectorAll('#pb-extra .pb-dash').length };
      }
      return r;
    });
    ok('полоса настроек у всех рисующих инструментов',
        ['ruler','vector','dim','circle','angle','area','note','guide'].every(t => tools[t].полоса)
        && !tools.pan.полоса && !tools.probe.полоса,
        Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, v.полоса])));
    ok('пунктир предложен направляющей и размерной линии',
        tools.guide.пунктир === 1 && tools.dim.пунктир === 1 && tools.ruler.пунктир === 0,
        { направляющая: tools.guide.пунктир, размер: tools.dim.пунктир, линейка: tools.ruler.пунктир });

    // Режим учителя: варианты различаются, ключ сходится с пересчётом.
    const teach = await p.evaluate(() => {
      const topics = ALL.filter(t => (t.problems || []).length).map(t => t.id);
      const v = buildVariants({ topics, levels: [1,2,3,4], count: 4, per: 4, seed: 11 });
      const наборы = new Set(v.map(x => x.items.map(i => JSON.stringify(i.params)).join('|')));
      let сошлось = 0, всего = 0;
      for (const вар of v) for (const it of вар.items) {
        всего++;
        const заново = it.pr.answer(it.params);
        if (Number.isFinite(заново) && Number.isFinite(it.answer) &&
            Math.abs(заново - it.answer) <= Math.abs(it.answer) * 1e-12) сошлось++;
      }
      return { вариантов: v.length, различных: наборы.size, всего, сошлось };
    });
    ok('варианты контрольной различаются', teach.различных === teach.вариантов, teach);
    ok('лист ответов сходится с пересчётом', teach.сошлось === teach.всего && teach.всего > 10, teach);

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
