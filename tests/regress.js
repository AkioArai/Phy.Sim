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
    ok('темы и задачи на месте', counts.topics >= 34 && counts.problems >= 384, counts);

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

    /* Числовые оси. Считаем непрозрачные пиксели на слое, где нарисована ОДНА
       сетка: если оси с числами рисуются, чернил заметно больше. Проверяем две
       вещи — что настройка их и вправду убирает там, где они уместны, и что на
       схемах и графиках (schema) их нет ни при каком положении настройки:
       метрам на электрической схеме или PV-диаграмме взяться неоткуда. */
    const оси = await p.evaluate(() => {
      const чернила = (id, вкл) => {
        const a = A();
        S.settings.grid = true; S.settings.gridLabels = true; S.settings.axisTicks = вкл;
        resize();
        if (a.def.fit) Object.assign(a.view, a.def.fit(a.params, { W: scene.clientWidth, H: scene.clientHeight }));
        applyWorld(sctx); drawGrid(sctx);
        const d = sctx.getImageData(0, 0, scene.width, scene.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      };
      const нет = [], неубралось = [];
      for (const id of Object.keys(SIMS)) {
        openSim(id);
        const с = чернила(id, true), без = чернила(id, false);
        if (SIMS[id].schema) { if (с !== без) нет.push(id); }
        else if (!(с > без)) неубралось.push(id);
      }
      const схем = Object.keys(SIMS).filter(id => SIMS[id].schema).length;
      return { нет, неубралось, схем };
    });
    ok('на схемах и графиках числовых осей нет', оси.нет.length === 0, оси.нет.slice(0, 5));
    ok('настройка убирает числовые оси', оси.неубралось.length === 0, оси.неубралось.slice(0, 5));
    ok('схемы размечены', оси.схем === 42, оси.схем);

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

    /* Формула может не упасть, а тихо превратиться в набор букв: одиночный
       слеш в шаблонной строке JS съедает до KaTeX, и «\dfrac» приезжает как
       «dfrac». Сборка ловит это в исходнике, здесь — в готовых данных: гоняем
       каждый кусок через KaTeX с throwOnError и отдельно ищем имена команд,
       оставшиеся без слеша. Внутренности \text{} и \mathrm{} пропускаем —
       там «max» и «tg» стоят законно. */
    const тех = await p.evaluate(() => {
      const КОМАНДЫ = ['dfrac', 'tfrac', 'frac', 'sqrt', 'sum', 'int', 'oint', 'vec', 'times',
        'cdot', 'alpha', 'beta', 'gamma', 'delta', 'Delta', 'theta', 'lambda', 'varphi',
        'varepsilon', 'omega', 'Omega', 'hbar', 'approx', 'propto', 'perp', 'text', 'mathrm',
        'left', 'right', 'quad', 'qquad', 'partial', 'infty', 'rightarrow', 'ddot', 'langle'];
      const плохо = [];
      const txt = s => { const d = document.createElement('div'); d.innerHTML = s; return d.textContent; };
      const куски = s => { const o = []; const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g; let m;
        while ((m = re.exec(s))) o.push([m[1] || m[2], !!m[1]]); return o; };
      const проба = (id, сырое, dm) => {
        if (typeof сырое !== 'string') return;
        /* Как и в приложении: строка едет через innerHTML, поэтому «&lt;»
           доходит до KaTeX уже как «<». Сравниваем то же, что увидит он. */
        const tex = txt(сырое);
        try { katex.renderToString(tex, { displayMode: dm, throwOnError: true }); }
        catch (e) { плохо.push(id + ': ' + tex.slice(0, 50) + ' — ' + e.message.slice(0, 60)); return; }
        const голый = tex.replace(/\\(?:text|mathrm|operatorname)\{[^}]*\}/g, '');
        for (const k of КОМАНДЫ)
          if (new RegExp('(^|[^\\\\A-Za-z])' + k + '(?![A-Za-z])').test(голый))
            { плохо.push(id + ': ' + tex.slice(0, 50) + ' — потерян слеш перед «' + k + '»'); return; }
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(tex))
          плохо.push(id + ': управляющий символ вместо \\v/\\b/\\t');
      };
      const поле = (id, s) => { if (typeof s === 'string') for (const [x, dm] of куски(txt(s))) проба(id, x, dm); };
      let всего = 0;
      for (const t of ALL) {
        for (const f of t.formulas || []) { всего++; проба(t.id, f.tex, true); }
        for (const d of t.derivations || []) {
          всего++; проба(t.id, d.goal, true);
          for (const x of d.from || []) { всего++; проба(t.id, x, false); }
          for (const s of d.steps || []) { всего++; проба(t.id, s.tex, true); поле(t.id, s.why); }
        }
        for (const k of t.key || []) { всего++; поле(t.id, k); }
        for (const e of t.explore || []) { всего++; поле(t.id, e.do); поле(t.id, e.see); }
        for (const q of t.checks || []) { поле(t.id, q.q); поле(t.id, q.a); }
        for (const m of t.mistakes || []) { поле(t.id, m.wrong); поле(t.id, m.right); поле(t.id, m.why); }
        for (const l of t.links || []) поле(t.id, l.text);
        for (const pr of t.problems || []) { поле(t.id, pr.statement); поле(t.id, pr.hint); }
        поле(t.id, t.why); поле(t.id, t.theory);
      }
      return { всего, плохо };
    });
    ok('формулы не потеряли обратный слеш', тех.плохо.length === 0 && тех.всего > 600,
      тех.плохо.length ? тех.плохо.slice(0, 6) : тех.всего);

    /* Блоки пособия. Проверяем не наличие полей в данных (это делает
       curriculum.mjs), а что они дошли до экрана и работают: шаги вывода
       раскрываются по одному, решение примера открывается кнопкой. */
    const урок = await p.evaluate(async () => {
      openTopic('mech.osc');
      await new Promise(r => setTimeout(r, 120));
      const пусто = s => document.querySelectorAll(s).length;
      const шагов = () => document.querySelectorAll('.dv-step.on').length;
      const было = шагов();
      document.querySelector('.dv-next').click();
      const после = шагов();
      document.querySelector('.dv-all').click();
      const целиком = шагов();
      document.querySelector('.ex-go').click();
      const решение = document.querySelector('.example').classList.contains('open');
      return { зачем: пусто('.why'), предпосылки: пусто('.need'), выводов: пусто('.deriv'),
               примеров: пусто('.example'), вопросов: пусто('.qa'),
               было, после, целиком, решение };
    });
    ok('блоки пособия на экране',
       урок.зачем === 1 && урок.предпосылки === 2 && урок.выводов === 3 &&
       урок.примеров === 1 && урок.вопросов >= 5, урок);
    ok('вывод раскрывается по шагам',
       урок.было === 0 && урок.после === 1 && урок.целиком === 5, урок);
    ok('решение примера открывается', урок.решение === true, урок.решение);

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

    /* Стенд: сцена — фон страницы, конспект едет полосой справа.
       Проверяем не пиксели оформления, а само правило раскладки: сцена
       начинается от левого края и кончается там, где начинается полоса, а
       нижняя строка состояния свёрнута в две накладки. Если кто-то вернёт
       пристыкованную колонку, эти три числа разойдутся. */
    const стенд = await p.evaluate(() => {
      const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const сцена = r('#simpane'), полоса = r('#content');
      const верх = document.querySelector('.topbar'), низ = document.querySelector('#timeline');
      const строка = document.querySelector('.statusbar');
      return {
        сценаСлева: Math.round(сцена.left),
        стык: Math.round(полоса.left - сцена.right),      // сцена кончается ровно у полосы
        ширинаПолосы: Math.round(полоса.width),
        полосаДоНиза: Math.round(полоса.bottom - полоса.top) === Math.round(innerHeight),
        строкаСвёрнута: !строка || getComputedStyle(строка).display === 'none',
        пускВнизу: !!(низ && низ.contains(document.querySelector('#btn-play'))),
        масштабВверху: !!(верх && верх.contains(document.querySelector('#zoomval'))),
        докПлавает: getComputedStyle(document.querySelector('.rail')).position === 'absolute',
      };
    });
    ok('стенд: сцена — фон, конспект полосой справа',
      стенд.сценаСлева === 0 && стенд.стык === 0 && стенд.ширинаПолосы === 392 &&
      стенд.полосаДоНиза && стенд.строкаСвёрнута && стенд.пускВнизу &&
      стенд.масштабВверху && стенд.докПлавает, стенд);

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

    /* Лист: три положения, и ни в одном он не накрывает сцену.
       Это и есть главное обещание мобильного макета, поэтому проверяем его
       буквально: верх листа никогда не заходит на низ холста, а сцена при
       раскрытии ужимается — в полном положении до живой полосы 88 px. */
    const лист = await m.p.evaluate(async () => {
      const жди = () => new Promise(r => setTimeout(r, 400));
      const мерка = () => {
        const c = document.querySelector('#cwrap').getBoundingClientRect();
        const s = document.querySelector('#msheet').getBoundingClientRect();
        return { сцена: Math.round(c.height), листСверху: Math.round(s.top),
                 накрывает: Math.round(c.bottom) > Math.round(s.top) + 1 };
      };
      const out = {};
      for (const d of ['peek', 'half', 'full']) { setDetent(d); await жди(); out[d] = мерка(); }
      setDetent('peek'); await жди();
      out.вкладки = [...document.querySelectorAll('#msheet-tabs button')].map(b => b.dataset.sheet);
      out.показания = document.querySelectorAll('#msheet-ro .sr').length;
      out.док = getComputedStyle(document.querySelector('#mb-tools')).display !== 'none';
      return out;
    });
    ok('лист: три положения, сцена не закрыта',
      !лист.peek.накрывает && !лист.half.накрывает && !лист.full.накрывает &&
      лист.peek.сцена > лист.half.сцена && лист.half.сцена > лист.full.сцена &&
      лист.full.сцена === 88 && лист.вкладки.join(',') === 'params,notes,problems' &&
      лист.показания > 3 && лист.док, лист);

    await m.p.close();
  }

  await b.close(); server.close();
  console.log('\n' + (fails.length ? 'ПРОВАЛЕНО: ' + fails.join(' | ') : 'всё прошло'));
  process.exit(fails.length ? 1 : 0);
})();
