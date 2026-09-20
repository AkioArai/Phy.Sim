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

    /* Компиляция графика. Обещание тут сильное — «математически достоверный
       результат», — поэтому и проверяем его не на глаз, а против замкнутых
       формул, которые записаны здесь отдельно от кода симуляций.

       Баллистика: y(t) = y₀ + v₀sinθ·t − gt²/2 — её график считается по
       формуле, расхождение обязано быть нулевым.
       Пружина: x(t) = A·cos(ωt), ω = √(k/m) — здесь идёт настоящее
       интегрирование, поэтому проверяем и то, что мельче шаг — точнее ответ.
       И отдельно: два запуска подряд дают побитово одно и то же. */
    const комп = await p.evaluate(() => {
      const из = {};
      openSim('proj2d');
      const a = A();
      Object.assign(a.params, { bodies: '1', x01: 0, y01: 40, v01: 23.7, a01: 37,
                                ay: -9.8, stopLand: false, stopHit: false, tStop: 0 });
      const gi = a.def.graphs.findIndex(g => /высот/i.test(g.label));
      const бал = собратьРяд(a.def, a.params, 0, 3, 301, 16);
      const th = 37 * Math.PI / 180;
      из.баллистика = 0;
      бал.ts.forEach((t, i) => { const y = бал.ys[gi][0][i];
        if (y === null || !isFinite(y)) return;
        из.баллистика = Math.max(из.баллистика, Math.abs(y - (40 + 23.7 * Math.sin(th) * t - 9.8 * t * t / 2))); });

      const п1 = собратьРяд(a.def, a.params, 0, 2, 101, 4);
      const п2 = собратьРяд(a.def, a.params, 0, 2, 101, 4);
      из.повторяется = JSON.stringify(п1) === JSON.stringify(п2);

      openSim('spring');
      const b = A();
      Object.assign(b.params, { m: 0.8, k: 50, A: 0.6, damp: false, periods: 0, tStop: 0 });
      const gj = b.def.graphs.findIndex(g => /Смещение/i.test(g.label));
      const w = Math.sqrt(50 / 0.8);
      const мера = дробь => { const р = собратьРяд(b.def, b.params, 0, 2, 201, дробь); let м = 0;
        р.ts.forEach((t, i) => { const y = р.ys[gj][0][i]; if (y === null || !isFinite(y)) return;
          м = Math.max(м, Math.abs(y - 0.6 * Math.cos(w * t))); }); return м; };
      из.пружина1 = мера(1); из.пружина4 = мера(4); из.пружина16 = мера(16);

      // событие обрывает кривую там же, где его считает физика: 2v₀sinθ/g
      openSim('proj2d');
      const c = A();
      Object.assign(c.params, { bodies: '1', y01: 0, v01: 25, a01: 45, ay: -9.8,
                                stopLand: true, tStop: 0 });
      const соб = собратьРяд(c.def, c.params, 0, 20, 400, 1);
      из.падение = соб.stop ? +соб.stop.t.toFixed(2) : null;
      из.падениеЖдём = +(2 * 25 * Math.sin(Math.PI / 4) / 9.8).toFixed(2);

      // ни одна симуляция с графиками по времени не должна падать при компиляции
      из.бросили = [];
      for (const id of Object.keys(SIMS)) {
        const d = SIMS[id];
        if (!d.graphs || !d.graphs.length || d.timeless) continue;
        try { openSim(id); const x = A();
          const р = собратьРяд(x.def, x.params, 0, 2, 40, 1);
          графикВКартинку({ a: x, ряд: р, какие: [0], W: 600, Hодного: 360, формат: 'svg', светлая: true });
        } catch (e) { из.бросили.push(id + ': ' + e.message); }
      }
      return из;
    });
    /* Компиляция на телефоне падала по двум причинам, и обе невидимы:
       холст больше предела браузера рисуется ПУСТЫМ без единой ошибки, а
       ссылка с download в Android-обёртке молча ничего не делает. Проверяем
       первое здесь (второе — в Java, её видно только в .apk).

       Числа: четыре графика стопкой при удвоении дают 13,8 Мпикс, на
       телефоне предел вдвое ниже. Ограничитель обязан ужать картинку, а не
       отдать белый лист. */
    const холсты = await p.evaluate(() => {
      openSim('proj2d');                       // четыре графика — худший случай
      const a = A();
      const ряд = собратьРяд(a.def, a.params, 0, 4, 200, 1);
      const все = a.def.graphs.map((_, i) => i);
      const мера = (W, H) => { const из = графикВКартинку({ a, ряд, какие: все, W, Hодного: H,
                                                           формат: 'png', светлая: true });
        return { мпикс: +(из.холст.width * из.холст.height / 1e6).toFixed(2),
                 пусто: !холстНеПустой(из.холст) }; };
      return { обычный: мера(1200, 720), огромный: мера(4000, 4000), графиков: все.length };
    });
    ok('картинка графика влезает в предел холста',
      холсты.графиков >= 4 && !холсты.обычный.пусто && !холсты.огромный.пусто &&
      холсты.обычный.мпикс <= 16 && холсты.огромный.мпикс <= 16, холсты);

    ok('компиляция графика сходится с формулой',
      комп.баллистика === 0 && комп.повторяется &&
      комп.пружина16 < 5e-6 && комп.пружина4 < комп.пружина1 / 4 &&
      комп.падение === комп.падениеЖдём && комп.бросили.length === 0,
      { ...комп, бросили: комп.бросили.slice(0, 3) });

    /* РАЗВЁРТКА ПО ПАРАМЕТРУ. До неё компилировать умели 36 симуляций из 76:
       остальные объявлены timeless, и графика по времени у них нет вовсе.
       Зависимость там есть, просто не от времени. Проверяем по закону
       Кулона: вне заряженного шара E·r² обязано быть постоянным. */
    const разв = await p.evaluate(async () => {
      let времени = 0, параметром = 0; const никак = [];
      for (const id of Object.keys(SIMS)) {
        openSim(id);
        const m = режимыКомпиляции(A());
        if (m.time) времени++;
        if (m.sweep) параметром++;
        if (!m.time && !m.sweep) никак.push(id);
      }
      openSim('charged');
      await new Promise(z => setTimeout(z, 150));
      const a = A(), пок = показателиСимуляции(a.def, a.params);
      const gi = (пок.find(x => /^поле E/.test(x.label)) || {}).i;
      const ряд = await собратьРазвёртку(a.def, a.params, 'px', 2, 8, 25, 0, 1, [gi], null);
      const пары = ряд.ts.map((x, i) => [x, ряд.ys[0][0][i]])
                        .filter(([, y]) => y !== null && isFinite(y));
      const вне = пары.filter(([x]) => Math.abs(x) > a.params.R * 1.2).map(([x, y]) => y * x * x);
      const разброс = вне.length ? (Math.max(...вне) - Math.min(...вне)) / Math.abs(вне[0]) : 1;
      // и та же развёртка целиком, через картинку
      let файл = null;
      const былоСохр = window.сохранитьФайл;
      window.сохранитьФайл = async (имя, blob) => { файл = { имя, текст: await blob.text() }; return 'ссылка'; };
      открытьКомпиляцию();
      document.querySelector('#pl-mode').value = 'sweep';
      document.querySelector('#pl-mode').dispatchEvent(new Event('change'));
      await new Promise(z => setTimeout(z, 60));
      document.querySelector('#pl-par').value = 'px';
      document.querySelector('#pl-par').dispatchEvent(new Event('change'));
      document.querySelector('#pl-p0').value = '2';
      document.querySelector('#pl-p1').value = '9';
      document.querySelector('#pl-pts').value = '40';
      document.querySelector('#pl-fmt').value = 'svg';
      document.querySelector('#pl-which').value = String(gi);
      выполнитьКомпиляцию();
      for (let i = 0; i < 100 && !файл; i++) await new Promise(z => setTimeout(z, 50));
      window.сохранитьФайл = былоСохр;
      document.querySelector('#modal-plot').classList.add('hidden');
      return { времени, параметром, никак, точек: пары.length, разброс,
               имя: файл && файл.имя,
               точекВКривой: файл && ((файл.текст.match(/points="([^"]+)"/) || [])[1] || '').trim().split(/\s+/).length };
    });
    ok('развёртка по параметру работает там, где нет времени',
        разв.параметром >= 70 && разв.времени === 36 && разв.никак.length <= 3, разв);
    ok('развёртка сходится с законом Кулона',
        разв.точек === 25 && разв.разброс < 1e-12, { точек: разв.точек, разброс: разв.разброс });
    ok('развёртка доходит до картинки',
        разв.имя === 'charged-развёртка-px.svg' && разв.точекВКривой === 40,
        { имя: разв.имя, точек: разв.точекВКривой });

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
      const dot = document.querySelector('#pb-color');
      const num = document.querySelector('#pb-widths .pb-ni');
      const r = k => { const q = k.getBoundingClientRect();
        return [Math.round(q.left + q.width / 2), Math.round(q.top + q.height / 2)]; };
      return { видна: !b.classList.contains('hidden') && b.getBoundingClientRect().height > 0,
               влезает: b.scrollWidth <= b.clientWidth + 1,
               цвет: r(dot), толщина: num ? num.value : null };
    });
    ok('полоса настроек инструмента', bar.видна && bar.влезает && bar.толщина !== null, bar);

    /* Круговая палитра: открывается кнопкой-кружком, выбор мышью по кругу
       ставит цвет и запоминается в «недавних». Шести готовых кнопок в самой
       полосе больше нет — они внутри палитры. */
    await p.mouse.click(bar.цвет[0], bar.цвет[1]);
    await p.waitForTimeout(150);
    const круг = await p.evaluate(() => {
      const e = document.querySelector('#pop-color'), q = e.getBoundingClientRect();
      const cv = document.querySelector('#cw-canvas').getBoundingClientRect();
      return { открыта: !e.classList.contains('hidden'),
               вКадре: q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight,
               пресетов: document.querySelectorAll('#cw-presets .cw-p').length,
               круг: [Math.round(cv.left + cv.width * 0.78), Math.round(cv.top + cv.height * 0.3)] };
    });
    ok('круговая палитра открывается кнопкой цвета',
        круг.открыта && круг.вКадре && круг.пресетов === 6, круг);
    await p.mouse.move(круг.круг[0], круг.круг[1]);
    await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(150);
    const цвет = await p.evaluate(() => ({ c: markStyle('pencil').c, недавние: (S.recentColors || []).length }));
    ok('выбор по кругу ставит цвет и запоминается',
        /^#[0-9a-f]{6}$/.test(цвет.c) && цвет.недавние >= 1, цвет);
    await p.evaluate(() => document.querySelectorAll('.pop').forEach(x => x.classList.add('hidden')));

    /* Толщина вводится числом, а не выбирается из трёх-четырёх заготовок. */
    await p.fill('#pb-widths .pb-ni', '7.5');
    await p.press('#pb-widths .pb-ni', 'Enter');
    await p.waitForTimeout(150);
    const толщина = await p.evaluate(() => markStyle('pencil').w);
    ok('толщина задаётся числом', Math.abs(толщина - 7.5) < 1e-9, { w: толщина });

    /* Прозрачность — ползунком, а не тремя ступенями. */
    await p.evaluate(() => { const r = document.querySelector('.pb-alpha input[type=range]');
      r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true }));
      r.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(150);
    ok('прозрачность задаётся ползунком',
        Math.abs((await p.evaluate(() => markStyle('pencil').a)) - 0.4) < 1e-9);

    const scene = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect();
      return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; });
    await p.evaluate(() => { const a = A(); a.annos = []; setTool('pencil'); });
    await p.mouse.move(scene.cx - 60, scene.cy + 60); await p.mouse.down();
    for (const d of [20, 40, 60, 80]) { await p.mouse.move(scene.cx - 60 + d, scene.cy + 60 + d / 2); }
    await p.mouse.up(); await p.waitForTimeout(150);
    const drawn = await p.evaluate(() => { const a = A(), l = a.annos[a.annos.length - 1];
      return { всего: a.annos.length, тип: l && l.type, w: l && l.w, a: l && l.a }; });
    ok('карандаш рисует по холсту выбранным стилем',
        drawn.всего === 1 && drawn.тип === 'pencil' && Math.abs(drawn.w - 7.5) < 1e-9
        && Math.abs(drawn.a - 0.4) < 1e-9, drawn);

    // Полоса не должна накрывать шапки плавающих панелей — иначе их не схватить.
    const hud = await p.evaluate(() => {
      const r = document.querySelector('#hud .fp-head').getBoundingClientRect();
      const c = [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
      const top = document.elementFromPoint(c[0], c[1]);
      return { свободна: !!(top && top.closest('#hud .fp-head')),
               накрыта: top ? (top.id || top.className) : 'ничего' };
    });
    ok('полоса не накрывает шапку панели показателей', hud.свободна, hud);

    /* Настройки положены каждому рисующему инструменту, и каждому — ровно те,
       которыми он умеет пользоваться. В полосе остаётся только то, что меняют
       по ходу рисования; всё прочее — в «Ещё», иначе полоса не влезает в сцену. */
    const tools = await p.evaluate(async () => {
      const r = {};
      for (const t of ['pencil','ruler','circle','area','note','pan','select','eraser']) {
        setTool(t); await new Promise(z => setTimeout(z, 20));
        const bar = document.querySelector('#penbar');
        r[t] = { полоса: !bar.classList.contains('hidden'),
                 влезает: bar.scrollWidth <= bar.clientWidth + 1,
                 вПолосе: [...document.querySelectorAll('#pb-extra .pb-seg')].map(g => g.title),
                 вЕщё: [...document.querySelectorAll('#tm-body .tm-row .pb-seg')].map(g => g.title),
                 сброс: document.querySelectorAll('#pb-reset').length };
      }
      return r;
    });
    const рисующие = ['pencil','ruler','circle','area'];
    ok('полоса настроек у всех рисующих инструментов',
        рисующие.every(t => tools[t].полоса)
        && !tools.pan.полоса && !tools.select.полоса && !tools.eraser.полоса
        && !tools.note.полоса,        // у карточки своё оформление, полоса стилей ей не нужна
        Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, v.полоса])));
    ok('полоса инструмента влезает в сцену',
        рисующие.every(t => tools[t].влезает),
        Object.fromEntries(рисующие.map(t => [t, tools[t].влезает])));
    const ждём = {
      pencil: [],                                   // на компьютере у карандаша всё в полосе
      ruler:  ['Стрелки','Угол к горизонтали','Выноски как на чертеже','Единица измерения','Знаков после запятой','Подпись с числом'],
      circle: ['Заливка','Подпись с числом'],
      area:   ['Заливка','Подпись с числом'],
    };
    const разошлись = рисующие.filter(t => tools[t].вЕщё.join('|') !== ждём[t].join('|'));
    ok('каждому инструменту — свой набор настроек', разошлись.length === 0,
        Object.fromEntries(разошлись.map(t => [t, { надо: ждём[t], есть: tools[t].вЕщё }])));
    ok('сброс к исходному виду есть у каждого рисующего',
        рисующие.every(t => tools[t].сброс === 1),
        Object.fromEntries(рисующие.map(t => [t, tools[t].сброс])));

    /* Убранные инструменты: транспортир, направляющая, зум рамкой, пробник и
       след за телами. Вектор и размерная линия сведены в линейку. */
    const убрали = await p.evaluate(async () => {
      const кн = t => document.querySelectorAll(`#rail [data-tool="${t}"]`).length;
      setTool('pan'); линейкаСВыносками(); await new Promise(z => setTimeout(z, 20));
      const выноски = { инструмент: S.tool, ext: markStyle('ruler').ext };
      вектором(); await new Promise(z => setTimeout(z, 20));
      const вектор = { инструмент: S.tool, arr: markStyle('ruler').arr };
      return { кнопки: ['dim','vector','angle','guide','marquee','probe'].map(кн),
               след: document.querySelectorAll('#btn-trace').length,
               разделТулс: document.querySelectorAll('#secttools').length,
               выноски, вектор };
    });
    ok('убранные инструменты исчезли из стойки',
        убрали.кнопки.every(n => n === 0) && убрали.след === 0 && убрали.разделТулс === 0, убрали);
    ok('вектор и размерная линия сведены в линейку',
        убрали.выноски.инструмент === 'ruler' && убрали.выноски.ext === true
        && убрали.вектор.инструмент === 'ruler' && убрали.вектор.arr === 'end', убрали);

    /* ЗАМЕТКИ-КАРТОЧКИ. Были пометкой на холсте: уезжали вместе со сценой,
       правились через диалог и стирались случайным мазком резинки. Стали
       карточками в экранных координатах со своим заголовком, разметкой,
       размером и связями. */
    const зам = await p.evaluate(async () => {
      const пауза = m => new Promise(z => setTimeout(z, m));
      openSim('kin1d'); await пауза(200);
      LS.set('notes', {}); A().notes = []; renderNotes();
      новаяЗаметка(160, 120); await пауза(60);
      новаяЗаметка(360, 260); await пауза(60);
      const a = A(), [n1, n2] = a.notes;
      n1.title = 'Приложение 1'; n1.text = 'Обычная\n# Чуть крупнее\n## Совсем крупно'; n1.edit = false;
      n2.title = 'Приложение 2'; n2.text = 'Второй текст'; n2.edit = false;
      сохранитьЗаметки(); renderNotes(); await пауза(60);
      const разметка = { h1: document.querySelectorAll('.nc-body .h1').length,
                         h2: document.querySelectorAll('.nc-body .h2').length,
                         заголовки: [...document.querySelectorAll('.ncard .nc-t')].map(e => e.textContent) };
      // связь: линия рисуется, у каждой карточки появляется страница другой
      переключитьСвязь(a, n1.id, n2.id); await пауза(60);
      const связь = { links: [n1.links.length, n2.links.length],
                      линий: document.querySelectorAll('#notelinks line').length,
                      страниц: document.querySelectorAll('.nc-pager .nc-p').length };
      // чтение связанной внутри карточки
      document.querySelector('.ncard .nc-pager .nc-p').click(); await пауза(60);
      const внутри = { заголовок: document.querySelector('.ncard .nc-t').textContent,
                       назад: !!document.querySelector('.nc-back') };
      // резинка карточки не трогает
      setTool('eraser');
      for (let i = 0; i < 60; i++) erase(-30 + i, 0);
      const послеРезинки = A().notes.length;
      // переживают уход в другую симуляцию и обратно
      openSim('proj2d'); await пауза(120);
      const чужих = A().notes.length;
      openSim('kin1d'); await пауза(150);
      const вернулись = { заметок: A().notes.length, карточек: document.querySelectorAll('.ncard').length,
                          связей: A().notes[0].links.length };
      // выгрузка в файл
      let файл = null;
      const было = window.сохранитьФайл;
      window.сохранитьФайл = async (имя, blob) => { файл = { имя, текст: await blob.text() }; return 'ссылка'; };
      document.querySelector('#mi-notes-save').click();
      for (let i = 0; i < 60 && !файл; i++) await пауза(50);
      window.сохранитьФайл = было;
      A().notes = []; сохранитьЗаметки(); renderNotes();
      return { разметка, связь, внутри, послеРезинки, чужих, вернулись,
               файл: файл && { имя: файл.имя, заметок: JSON.parse(файл.текст).заметки.length } };
    });
    ok('заметка стала карточкой с заголовком и разметкой',
        зам.разметка.h1 === 1 && зам.разметка.h2 === 1
        && зам.разметка.заголовки.join('|') === 'Приложение 1|Приложение 2', зам.разметка);
    ok('заметки связываются и читаются одна в другой',
        зам.связь.links[0] === 1 && зам.связь.links[1] === 1 && зам.связь.линий === 1
        && зам.связь.страниц === 2 && зам.внутри.заголовок === 'Приложение 2' && зам.внутри.назад,
        { ...зам.связь, ...зам.внутри });
    ok('резинка не стирает заметки', зам.послеРезинки === 2, зам.послеРезинки);
    ok('заметки свои у каждой симуляции и переживают возврат',
        зам.чужих === 0 && зам.вернулись.заметок === 2 && зам.вернулись.карточек === 2
        && зам.вернулись.связей === 1, { чужих: зам.чужих, ...зам.вернулись });
    ok('заметки выгружаются в файл',
        зам.файл && зам.файл.имя === 'kin1d-заметки.json' && зам.файл.заметок === 2, зам.файл);

    /* Линейка меряет в выбранных единицах и с выбранной точностью. */
    const меры = await p.evaluate(() => ({
      м:  мераДлины(2.53718, { unit: 'm',  dec: 2 }),
      мм: мераДлины(2.53718, { unit: 'mm', dec: 1 }),
      км: мераДлины(2.53718, { unit: 'km', dec: 3 }),
    }));
    ok('линейка меряет в выбранных единицах',
        меры.м === '2.54 м' && меры.мм === '2537.2 мм' && меры.км === '0.003 км', меры);

    /* Shift при рисовании держит направление, а не панорамирует сцену:
       раньше Shift+ЛКМ уводил вид, и построить горизонталь было нечем. */
    const было = await p.evaluate(() => { const a = A(); a.annos = []; setTool('ruler');
      return { x: a.view.x, y: a.view.y }; });
    await p.keyboard.down('Shift');
    await p.mouse.move(scene.cx - 120, scene.cy - 40); await p.mouse.down();
    for (const d of [40, 90, 140]) await p.mouse.move(scene.cx - 120 + d, scene.cy - 40 + 7);
    await p.mouse.up();
    await p.keyboard.up('Shift');
    const ровно = await p.evaluate(() => { const a = A(), l = a.annos[a.annos.length - 1];
      return { всего: a.annos.length, тип: l && l.type,
               угол: l && Math.round(Math.atan2(l.p[3] - l.p[1], l.p[2] - l.p[0]) * 180 / Math.PI),
               вид: { x: a.view.x, y: a.view.y } }; });
    ok('Shift держит направление и не уводит сцену',
        ровно.всего === 1 && ровно.тип === 'ruler' && ровно.угол === 0
        && ровно.вид.x === было.x && ровно.вид.y === было.y, ровно);

    // Alt+клик стирает пометку, не заставляя уходить за резинкой в стойку.
    await p.keyboard.down('Alt');
    await p.mouse.click(scene.cx - 60, scene.cy - 40);
    await p.keyboard.up('Alt');
    const стёрли = await p.evaluate(() => ({ осталось: A().annos.length }));
    ok('Alt+клик стирает пометку под курсором', стёрли.осталось === 0, стёрли);

    /* Меню сцены разложено по вкладкам: на виду одна группа, а не все
       одиннадцать команд разом. «Конструктор» есть только там, где сцену
       действительно собирают мышью, и открывается сразу. */
    const menu = await p.evaluate(async () => {
      const видно = () => [...document.querySelectorAll('#pop-simmenu .mt-page:not(.hidden) .item')]
                            .map(i => i.textContent.trim());
      openSim('kin1d'); await new Promise(z => setTimeout(z, 150));
      openSimMenu(500, 300);
      const обычная = { вкладки: [...document.querySelectorAll('#simmenu-tabs .mt-t')].map(t => t.textContent),
                        сцена: видно() };
      setMenuTab('more'); обычная.ещё = видно();
      openSim('resistors'); await new Promise(z => setTimeout(z, 200));
      openSimMenu(500, 300);
      const цепь = { вкладки: [...document.querySelectorAll('#simmenu-tabs .mt-t')].map(t => t.textContent),
                     активна: document.querySelector('#simmenu-tabs .mt-t.on').dataset.tab,
                     деталей: document.querySelectorAll('#simmenu-tools .item').length };
      document.querySelector('#pop-simmenu').classList.add('hidden');
      return { обычная, цепь, всего: document.querySelectorAll('#pop-simmenu .item').length };
    });
    ok('меню сцены разложено по вкладкам',
        menu.обычная.вкладки.join('|') === 'Сцена|Данные|Наборы|Ещё'
        && menu.обычная.сцена.length === 5 && menu.обычная.ещё.length === 4
        && menu.всего > menu.обычная.сцена.length, menu.обычная);
    ok('конструктор получает свою вкладку и открывает её сразу',
        menu.цепь.вкладки.includes('Конструктор') && menu.цепь.активна === 'build'
        && menu.цепь.деталей > 0, menu.цепь);

    /* Меню открывают КНОПКОЙ, а не вызовом openSimMenu из теста. Кнопка идёт
       через общий popup(), который только снимает класс hidden: без сборки
       содержимого в меню оставалась одна вкладка «Сцена», а остальные
       команды исчезали. Проверка именно этого пути. */
    await p.evaluate(async () => { openSim('kin1d'); await new Promise(z => setTimeout(z, 200)); });
    await p.click('#btn-simmenu');
    await p.waitForTimeout(150);
    const кнопкой = await p.evaluate(() => ({
      вкладок: document.querySelectorAll('#simmenu-tabs .mt-t').length,
      всего: document.querySelectorAll('#pop-simmenu .item').length,
      видно: document.querySelectorAll('#pop-simmenu .mt-page:not(.hidden) .item').length,
      открыто: !document.querySelector('#pop-simmenu').classList.contains('hidden') }));
    ok('кнопка ⋮ открывает меню со всеми вкладками',
        кнопкой.открыто && кнопкой.вкладок === 4 && кнопкой.всего >= 12
        && кнопкой.видно >= 4, кнопкой);
    await p.evaluate(() => document.querySelectorAll('.pop').forEach(x => x.classList.add('hidden')));

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
               влезает: bar.scrollWidth <= bar.clientWidth + 1,
               кружок: !!document.querySelector('#pb-color'),
               толщина: !!document.querySelector('#pb-widths .pb-ni') };
    });
    /* На телефоне полосе достаётся 374 пикселя. У карандаша всё влезает;
       у линейки настроек больше, и полоса прокручивается вбок — при этом
       «⋯» и сброс прижаты справа и остаются на виду. */
    ok('карандаш на телефоне',
        mpen.видна && mpen.вКадре && mpen.влезает && mpen.кружок && mpen.толщина, mpen);

    /* На телефоне меню сцены открывают три разные кнопки, и каждая обязана
       собрать его заново: одна из них шла через общий popup() и оставляла
       меню без вкладок. */
    const мменю = await m.p.evaluate(async () => {
      const r = {};
      for (const s of ['#m-menu', '#m-more', '#mb-menu']) {
        document.querySelectorAll('.pop').forEach(x => x.classList.add('hidden'));
        document.querySelector('#simmenu-tabs').innerHTML = '';    // чистый лист перед каждой
        const b = document.querySelector(s); if (!b) { r[s] = null; continue; }
        b.click(); await new Promise(z => setTimeout(z, 60));
        r[s] = { вкладок: document.querySelectorAll('#simmenu-tabs .mt-t').length,
                 команд: document.querySelectorAll('#pop-simmenu .item').length };
      }
      document.querySelectorAll('.pop').forEach(x => x.classList.add('hidden'));
      return r;
    });
    ok('каждая кнопка меню на телефоне собирает вкладки',
        Object.values(мменю).every(v => v && v.вкладок === 4 && v.команд >= 12), мменю);

    /* Настройки во весь экран обязаны накрывать закреплённую обвязку: лист
       показаний лежал поперёк открытых настроек, потому что его слой (126)
       выше, чем был у настроек (120). */
    const поверх = await m.p.evaluate(async () => {
      openPrefs(); await new Promise(z => setTimeout(z, 250));
      const плохие = [];
      for (const s of ['#mbar', '#mbar2', '#msheet', '#timeline', '#stripctl']) {
        const e = document.querySelector(s); if (!e) continue;
        const q = e.getBoundingClientRect(); if (!q.height) continue;
        const t = document.elementFromPoint(Math.round(q.left + q.width / 2),
                                            Math.round(q.top + q.height / 2));
        if (t && !t.closest('#prefs')) плохие.push({ панель: s, сверху: t.id || String(t.className) });
      }
      closePrefs(); await new Promise(z => setTimeout(z, 120));
      return плохие;
    });
    ok('нижние панели не лезут поверх настроек', поверх.length === 0, поверх);

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
    /* Конспект на телефоне. Правила листа прятали `#content` в положении
       «край» — а это положение по умолчанию и единственное, когда симуляция
       закрыта. Читать на телефоне было нечего, при том что текст исправно
       рендерился: элемент просто был display:none.

       Проверяем в трёх состояниях, потому что `#content` играет две роли:
       самостоятельный экран чтения (сцены нет) и вкладка листа (сцена есть). */
    const конспект = await m.p.evaluate(async () => {
      const жди = () => new Promise(r => setTimeout(r, 500));
      const мерка = () => { const c = document.querySelector('#content');
        const r = c.getBoundingClientRect();
        return { видно: getComputedStyle(c).display !== 'none' && r.width > 0 && r.height > 0,
                 высота: Math.round(r.height),
                 текста: (document.querySelector('#pane').textContent || '').trim().length }; };
      const из = {};
      document.querySelector('#btn-simback').click(); await жди();
      из.безСцены = мерка();
      openTopic('mech.2d'); await жди();
      из.послеТемы = мерка();
      setSheetTab('params'); await жди();
      из.параметры = мерка();
      setSheetTab('notes'); await жди();
      из.чтение = мерка();
      из.detentЧтения = document.documentElement.dataset.detent;
      return из;
    });
    ok('конспект на телефоне виден',
      конспект.безСцены.видно && конспект.безСцены.текста > 500 &&
      конспект.послеТемы.видно && конспект.чтение.видно &&
      !конспект.параметры.видно &&          // на вкладке параметров его и не должно быть
      конспект.чтение.высота > 400 &&       // на чтение отдан весь лист, а не три строки
      конспект.detentЧтения === 'full', конспект);

    /* Разделители пальцем. На планшете в режиме компьютера протяг по
       разделителю браузер принимал за прокрутку и отбирал жест — панель
       ехала рывками. Лечится `touch-action:none`; проверяем именно свойство,
       потому что симулировать «отобранный жест» в тесте нечем. */
    const хваты = await m.p.evaluate(() => {
      const ст = s => { const e = document.querySelector(s); if (!e) return null;
        const c = getComputedStyle(e); return c.touchAction; };
      return { hsplit: ст('#hsplit'), splitter: ст('.splitter'), шапка: ст('.fp-head') };
    });
    ok('разделители не отдают жест прокрутке',
      хваты.hsplit === 'none' && хваты.splitter === 'none', хваты);

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
