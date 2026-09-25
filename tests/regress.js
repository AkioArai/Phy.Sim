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
  // с 2.1.0 пособие открывается главным экраном; тесты работают с темой под ним
  await p.evaluate(() => { if (typeof закрытьГлавную === 'function') закрытьГлавную(); });
  return { p, errs };
}

/* ВЕРСИЯ В ЧЕТЫРЁХ МЕСТАХ. Имя кэша служебного потока несёт номер выпуска:
   по его смене старый кэш сносится целиком. Пока имя было постоянным, файлы
   обновлялись поодиночке, и открытие могло получить разметку одного выпуска
   со скриптом другого — приложение умирало на первой же привязке обработчика
   и показывало отрисованную страницу, где ничего не работает. Метки в
   index.html и app.js сверяет сторож в самой странице. Разойтись им нельзя. */
function проверитьВерсии() {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const взять = (файл, re) => (fs.readFileSync(path.join(ROOT, файл), 'utf8').match(re) || [])[1];
  const где = {
    'sw.js':       взять('sw.js', /const ВЕРСИЯ = '([^']*)'/),
    'index.html':  взять('index.html', /<meta name="physim-build" content="([^"]*)">/),
    'js/app.js':   взять('js/app.js', /window\.PHYSIM_BUILD = '([^']*)'/),
  };
  const плохие = Object.entries(где).filter(([, x]) => x !== v);
  ok('версия одна во всех файлах', плохие.length === 0, { 'package.json': v, ...где });
}

/* ПЛАНШЕТЫ. Здесь ломалось чаще всего, и по трём разным причинам.
   1. Поворот: ширина сцены, выставленная разделителем в альбомной
      ориентации, оставалась в style и перебивала телефонную раскладку —
      сцена в 740 px на экране в 820.
   2. Средняя ширина: планшет боком получает компьютерную раскладку, а в ней
      панель тем 280 px и сцена 470 px оставляли конспекту 161–481 px.
   3. Палец: кнопки 26×24 и ручка разделителя в 5 px.
   Проверяем на iPad Air (820×1180) и iPad Pro 12,9 (1024×1366) — первый в
   портрете телефонный, боком компьютерный; второй компьютерный в обоих. */
const UA_IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
async function планшеты(b, url, label) {
  console.log('--- ' + label + ' (планшет) ---');
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, userAgent: UA_IPAD });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**cdnjs.cloudflare.com**', r => r.abort());
  await p.goto(url);
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(500);
  const вид = () => p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect();
      return getComputedStyle(e).display === 'none' || !b.width ? 0 : Math.round(b.width); };
    const мелкие = [...document.querySelectorAll('.statusbar button,.simhead button,.timeline button,.rail button')]
      .filter(x => { const b = x.getBoundingClientRect(); return getComputedStyle(x).display !== 'none' && b.width > 0 &&
        b.top < innerHeight && (b.width < 34 || b.height < 34); }).map(x => x.id || x.className);
    return { ui: document.documentElement.dataset.ui, W: innerWidth, конспект: r('#content'), сцена: r('#simpane'),
             styleСцены: document.querySelector('#simpane').getAttribute('style') || '',
             темыПоверх: document.querySelector('#app').classList.contains('mid'),
             темыОткрыты: !document.querySelector('#sidebar').classList.contains('hidden'), мелкие };
  });
  await p.evaluate(() => openTopic('mech.2d')); await p.waitForTimeout(300);
  const портрет = await вид();
  await p.setViewportSize({ width: 1180, height: 820 }); await p.waitForTimeout(600);
  const альбом = await вид();
  // пальцем растягиваем сцену почти во весь экран
  const r = await (await p.$('#splitter')).boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + 150); await p.mouse.down();
  await p.mouse.move(60, r.y + 150, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  const растянули = await вид();
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(600);
  const назад = await вид();
  await p.setViewportSize({ width: 1024, height: 1366 }); await p.waitForTimeout(600);
  const про = await вид();
  ok('планшет: поворот без ошибок', errs.length === 0, errs.slice(0, 3));
  ok('планшет боком: конспекту не меньше 360 px, панель тем поверх',
    альбом.ui === 'desktop' && альбом.конспект >= 360 && альбом.темыПоверх && !альбом.темыОткрыты &&
    растянули.конспект >= 360 && про.конспект >= 360, { альбом, растянули, про });
  ok('планшет: после поворота ширина сцены не перебивает телефонную раскладку',
    портрет.ui === 'mobile' && назад.ui === 'mobile' && назад.styleСцены === '' && назад.сцена === 820,
    { портрет, назад });
  ok('планшет боком: кнопки под палец не меньше 34 px', альбом.мелкие.length === 0, альбом.мелкие);
  await ctx.close();

  /* Настройки на Android-планшете. Поле поиска получало фокус, выезжала
     клавиатура, окно становилось ниже 560 px — и планшет считался телефоном
     на боку: раскладка переключалась, телефонный лист ставил конспекту
     display:none прямо в style, а после возврата стиль оставался. Текст
     пропадал насовсем. Проверяем обе защиты: (1) клавиатура раскладку не
     переключает — высоту решает экран, а не окно; (2) если раскладка всё же
     переключилась туда и обратно, конспект возвращается. */
  const клав = await b.newContext({ viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
  const видКонспекта = pg => pg.evaluate(() => { const c = document.querySelector('#content'), r = c.getBoundingClientRect();
    return { ui: document.documentElement.dataset.ui, виден: getComputedStyle(c).display !== 'none' && r.width > 300 && r.height > 100,
             фокус: document.activeElement && document.activeElement.id }; });
  const сценарий = async закрепитьЭкран => {
    const pg = await клав.newPage();
    if (закрепитьЭкран) await pg.addInitScript(() => { Object.defineProperty(screen, 'width', { get: () => 1280 });
      Object.defineProperty(screen, 'height', { get: () => 800 }); });
    await pg.route('**cdnjs.cloudflare.com**', r => r.abort());
    await pg.goto(url); await pg.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(400);
    await pg.setViewportSize({ width: 1280, height: 800 });
    await pg.evaluate(() => openTopic('mech.2d')); await pg.waitForTimeout(300);
    await pg.click('#btn-settings'); await pg.waitForTimeout(150);
    const фокус = (await видКонспекта(pg)).фокус;
    await pg.setViewportSize({ width: 1280, height: 380 }); await pg.waitForTimeout(400);     // клавиатура
    const при = await видКонспекта(pg);
    await pg.click('#prefs-close'); await pg.setViewportSize({ width: 1280, height: 800 }); await pg.waitForTimeout(500);
    const после = await видКонспекта(pg);
    await pg.close();
    return { фокус, при, после };
  };
  const настоящий = await сценарий(true), переключили = await сценарий(false);
  await клав.close();
  ok('настройки на планшете: клавиатура не переключает раскладку и не зовётся зря',
    настоящий.при.ui === 'desktop' && настоящий.фокус !== 'prefs-search' && настоящий.после.виден, настоящий);
  ok('после смены раскладки туда и обратно конспект виден', переключили.после.ui === 'desktop' && переключили.после.виден, переключили);
}

/* ПОВТОРНЫЙ ЗАПУСК. Все остальные проверки открывают страницу с чистым
   хранилищем — а человек открывает пособие во второй, десятый, сотый раз.
   С 1.6.0 по 1.8.0 каждый повторный запуск падал: блок запуска стоял в
   середине app.js, восстанавливал прошлую тему с симуляцией, та читала
   заметки, а ключ заметок был объявлен ниже — «мёртвая зона» const. Первый
   запуск открывал введение и проскакивал, поэтому тесты молчали.
   Здесь: для каждой темы (в одностраничнике — для трёх) запоминаем её,
   кладём заметку и перезапускаем страницу в том же хранилище. */
async function повторныйЗапуск(b, url, label, всеТемы) {
  console.log('--- ' + label + ' (повторный запуск) ---');
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**cdnjs.cloudflare.com**', r => r.abort());
  await p.goto(url); await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {});
  const темы = await p.evaluate(() => ALL.map(t => t.id));
  const выбор = всеТемы ? темы : ['intro', 'mech.2d', 'el.current'].filter(t => темы.includes(t));
  const упали = [];
  for (const id of выбор) {
    errs.length = 0;
    await p.evaluate(id => { openTopic(id);
      // заметка к открытой симуляции — ровно то, что роняло запуск
      if (S.active) { const все = LS.get('notes', {}) || {}; все[S.active] = [{ id: 'n1', x: .5, y: .5, title: 'проверка', body: '', links: [] }]; LS.set('notes', все); }
    }, id);
    await p.reload(); await p.waitForTimeout(250);
    const r = await p.evaluate(() => ({ готов: window.PHYSIM_READY === true, тема: S.topic && S.topic.id,
      текст: (document.querySelector('#pane').textContent || '').trim().length }));
    if (errs.length || !r.готов || r.тема !== id || r.текст < 50) упали.push(id + ': ' + (errs[0] || JSON.stringify(r)));
  }
  await ctx.close();
  ok(`повторный запуск восстанавливает тему без ошибок (${выбор.length} тем)`, упали.length === 0, упали.slice(0, 4));
}

/* СТОРОЖ СТРАНИЦЫ и старые движки. Настоящего старого браузера здесь нет,
   поэтому (а) убираем из страницы то, чего в старых нет, и смотрим, что
   пособие живо; (б) ломаем app.js и смотрим, что человек получает
   объяснение, а не картинку без слов. Только исходники: в одностраничнике
   app.js встроен в страницу, подменить его отдельно нельзя. */
async function сторож(b) {
  console.log('\n=== старые движки и сторож страницы ===');
  const url = 'http://localhost:8971/';
  const открыть = async (подготовка, опции) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1200, height: 800 } }, опции || {}));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**cdnjs.cloudflare.com**', r => r.abort());
    if (подготовка) await подготовка(p);
    await p.goto(url); await p.waitForTimeout(5200);
    const итог = await p.evaluate(() => {
      const d = [...document.querySelectorAll('body > div')].find(x => (x.getAttribute('style') || '').includes('9999'));
      return { готов: window.PHYSIM_READY === true, сообщение: d ? d.innerText.replace(/\s+/g, ' ') : '' };
    });
    await ctx.close();
    return Object.assign(итог, { errs });
  };
  const безНового = await открыть(p => p.addInitScript(() => {
    delete window.ResizeObserver; MediaQueryList.prototype.addEventListener = undefined;
    Blob.prototype.text = undefined; delete Promise.prototype.finally;
  }));
  ok('без ResizeObserver, addEventListener у медиазапроса, Blob.text и finally пособие работает',
    безНового.готов && !безНового.сообщение && безНового.errs.length === 0, безНового);
  const упал = await открыть(async p => {
    await p.route('**/js/app.js', r => r.fulfill({ contentType: 'text/javascript', body: 'const x = a?.b ?? ;' }));
    await p.addInitScript(() => { try { sessionStorage.setItem('physim-чинили', '1'); } catch (e) {} });
  });
  ok('упал скрипт — сторож объясняет и показывает саму ошибку',
    /не загрузилось/.test(упал.сообщение) && /app\.js:\d+/.test(упал.сообщение), упал.сообщение.slice(0, 200));
  const старый = await открыть(async p => {
    await p.route('**/js/app.js', r => r.fulfill({ contentType: 'text/javascript', body: 'const x = a?.b;' }));
    await p.addInitScript(() => { delete window.PointerEvent; });
  }, { userAgent: 'Mozilla/5.0 (Linux; Android 7.1.1; TB-X304L; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Safari/537.36' });
  ok('старый WebView — сторож называет движок и что обновить',
    /слишком старый/.test(старый.сообщение) && /Android WebView 55/.test(старый.сообщение) &&
    /Android System WebView/.test(старый.сообщение), старый.сообщение.slice(0, 260));
}

(async () => {
  проверитьВерсии();
  await new Promise(r => server.listen(8971, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  for (const [label, url] of [['исходники', 'http://localhost:8971/'],
                              ['одностраничник', 'http://localhost:8971/phy-sim-standalone.html']]) {
    console.log('\n=== ' + label + ' (ПК) ===');
    const { p, errs } = await boot(b, url, 'desk');

    ok('загрузка без ошибок', errs.length === 0, errs.slice(0, 3));

    /* Скрипт обязан доложить, что дочитан до конца: на эту отметку смотрит
       сторож в странице. Без неё он решит, что загрузка сорвалась. */
    const метка = await p.evaluate(() => ({ готов: window.PHYSIM_READY === true,
                                            сборка: window.PHYSIM_BUILD || null }));
    ok('скрипт доложил о полной загрузке', метка.готов && !!метка.сборка, метка);

    /* Пропавший элемент разметки стоит одной кнопки, а не всего пособия:
       обработчики на верхнем уровне вешаются через терпимый к null поиск. */
    const терпит = await p.evaluate(() => {
      try { $$('#такого-элемента-нет').onclick = () => {};
            $$('#такого-элемента-нет').addEventListener('click', () => {});
            $$('#такого-элемента-нет').classList.toggle('x', true);
            return 'ок'; }
      catch (e) { return e.message; }
    });
    ok('нехватка элемента не роняет скрипт', терпит === 'ок', терпит);

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
          /* Показание — это массив [подпись, значение, единица], а не объект.
             Проверка читала x.v, которого у массива нет: условие никогда не
             выполнялось, и за всё время она не проверила ни одной величины.
             Само по себе нечисловое значение законно — им пользуются там, где
             величины нет: «угол конуса Маха» до перехода через скорость звука,
             «изображение — действительное», заголовок раздела показаний.
             Важно другое: ученику нельзя показать слово NaN. fmt() обязан
             превратить такое в прочерк — это и проверяем. */
          const r = a.def.readouts ? a.def.readouts(a.state, a.params) : [];
          for (const стр of r) {
            if (typeof стр[1] !== 'number' || isFinite(стр[1])) continue;
            const показ = fmt(стр[1]);
            if (/nan|infinity/i.test(показ)) bad.NaN.push(`${id}: «${стр[0]}» → ${показ}`);
          }
        } catch (e) { bad.бросили.push(id + ': ' + e.message); }
      }
      return bad;
    });
    ok('все симуляции считаются и рисуются', sims.бросили.length === 0, sims.бросили.slice(0, 5));
    ok('нечисловые показания выводятся прочерком, а не словом NaN', sims.NaN.length === 0, sims.NaN.slice(0, 5));

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
        && menu.обычная.сцена.length === 5 && menu.обычная.ещё.length === 6 && menu.обычная.ещё.includes('Мой путь')
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

    /* ОТМЕТКИ О РЕШЁННОМ. Ключом служило место задачи в главе (тема + номер),
       поэтому вставленная в середину задача сдвигала чужие галочки на соседей:
       человек открывал главу и видел решённым то, чего не решал. Теперь ключ —
       имя задачи, посчитанное по её условию. Проверяем оба свойства: имя не
       меняется от вставки и ни у каких двух задач оно не совпадает. */
    const имена = await p.evaluate(() => {
      const t = ALL.find(x => (x.problems || []).length > 2);
      const было = t.problems.map(pr => идЗадачи(t, pr));
      t.problems.unshift({ name: 'вставка', statement: 'Свежая задача, вставленная первой.' });
      const стало = t.problems.slice(1).map(pr => идЗадачи(t, pr));
      t.problems.shift();
      const видели = new Set();
      let всего = 0, повторов = 0;
      for (const тема of ALL) for (const pr of тема.problems || []) {
        всего++;
        const k = идЗадачи(тема, pr);
        if (видели.has(k)) повторов++;
        видели.add(k);
      }
      return { сдвинулось: было.filter((k, i) => k !== стало[i]).length, всего, повторов };
    });
    ok('имя задачи не зависит от её места в главе',
        имена.сдвинулось === 0 && имена.повторов === 0 && имена.всего >= 384, имена);

    /* Архив с прошлой версии и уже сохранённый прогресс написаны старыми
       ключами. Их переводят на имена — и тот, кого не опознали, остаётся как
       был: лучше лишняя галочка, чем потерянная. */
    const пер = await p.evaluate(() => {
      const t = ALL.find(x => (x.problems || []).length > 2);
      const стало = перевестиОтметки({ [t.id + '#1']: true, 'нет-такой-темы#9': true });
      return { перевели: стало[идЗадачи(t, t.problems[1])] === true,
               староеУбрали: !((t.id + '#1') in стало),
               чужоеСберегли: стало['нет-такой-темы#9'] === true };
    });
    ok('старые отметки по номеру переводятся в имена',
        пер.перевели && пер.староеУбрали && пер.чужоеСберегли, пер);

    /* Настройки открывали раздел по имени из хранилища. Имя из будущей версии
       (или просто опечатка) не находилось в списке, и весь экран падал на
       чтении имени у ничего. Незнакомый раздел должен превращаться в первый. */
    const наст = await p.evaluate(() => {
      try {
        openPrefs('такого-раздела-нет');
        const t = document.querySelector('#prefs-title').textContent;
        const n = document.querySelectorAll('#prefs-body *').length;
        closePrefs();
        return { заголовок: t, полей: n };
      } catch (e) { return { ошибка: e.message }; }
    });
    ok('настройки переживают неизвестный раздел',
        !наст.ошибка && !!наст.заголовок && наст.полей > 0, наст);

    /* ПРИЁМЫ ВЫВОДОВ. Под каждым шагом — метки математики, которой он сделан
       (js/ops.js), метка открывает карточку статьи, из карточки — переход в
       другой вывод тем же приёмом. Отдельной главы математики нет, поэтому
       всё это держится на трёх вещах, их и проверяем: метки дошли до экрана
       все до одной, карточка встаёт у метки и не закрывает её, переход
       раскрывает нужный вывод до нужного шага. */
    const приём = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      openTopic('mech.osc'); await жди(150);
      const ожидалось = S.topic.derivations.reduce((n, dv) =>
        n + dv.steps.reduce((m, st) => m + st.op.length, 0), 0);
      const меток = document.querySelectorAll('#pane .op-chip').length;
      const d = document.querySelector('#pane .deriv[data-d="1"]');
      d.querySelector('.dv-all').click();
      const чип = d.querySelector('.dv-step[data-k="1"] .op-chip');
      чип.scrollIntoView({ block: 'center' }); await жди(50);
      чип.click(); await жди(200);
      const c = document.querySelector('#opcard');
      const cr = c.getBoundingClientRect(), mr = чип.getBoundingClientRect();
      const out = {
        меток, ожидалось, открыта: приёмОткрыт(), приём: c.dataset.op,
        формул: c.querySelectorAll('.katex').length,
        вКадре: cr.left >= 0 && cr.top >= 0 && cr.right <= innerWidth && cr.bottom <= innerHeight,
        меткаВидна: mr.bottom <= cr.top || mr.top >= cr.bottom || mr.right <= cr.left || mr.left >= cr.right,
        ссылок: c.querySelectorAll('.opc-go').length,
      };
      const go = c.querySelector('.opc-go');
      const [tid, dd, kk] = [go.dataset.t, +go.dataset.d, +go.dataset.k];
      go.click(); await жди(400);
      const шаг = document.querySelector(`#pane .deriv[data-d="${dd}"] .dv-step[data-k="${kk}"]`);
      out.перешли = S.topic.id === tid && !!шаг && шаг.classList.contains('on') &&
        !!шаг.querySelector(`.op-chip[data-op="${out.приём}"]`);
      out.закрылась = !приёмОткрыт();
      /* Справочник: вкладки обязаны показывать по одной странице. До 1.7.0
         у .ref-body.hidden не было правила, и все страницы стояли друг под
         другом — вкладка «Константы» подсвечивалась, но ничего не меняла. */
      openPrefs('ref'); await жди(100);
      document.querySelector('#prefs [data-ref="o"]').click();
      out.страниц = [...document.querySelectorAll('#prefs .ref-body')]
        .filter(x => getComputedStyle(x).display !== 'none').length;
      out.рядов = document.querySelectorAll('#prefs .op-row').length;
      document.querySelector('#prefs .op-row').click(); await жди(100);
      out.изСправочника = приёмОткрыт();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await жди(50);
      out.escЗакрыл = !приёмОткрыт();
      out.настройкиОстались = !document.querySelector('#prefs').classList.contains('hidden');
      closePrefs();
      return out;
    });
    ok('метки приёмов стоят под каждым шагом вывода',
        приём.меток > 0 && приём.меток === приём.ожидалось, приём);
    ok('карточка приёма встаёт у метки и не закрывает её',
        приём.открыта && приём.приём === 'малый-угол' && приём.формул > 0 &&
        приём.вКадре && приём.меткаВидна, приём);
    ok('из карточки — в другой вывод тем же приёмом, до нужного шага',
        приём.ссылок >= 1 && приём.перешли && приём.закрылась, приём);
    ok('вкладки справочника показывают по одной странице',
        приём.страниц === 1 && приём.рядов === 40, приём);
    ok('Esc закрывает карточку, а настройки под ней остаются',
        приём.изСправочника && приём.escЗакрыл && приём.настройкиОстались, приём);

    /* ВЫЧИСЛИТЕЛЬ. Сам счёт проверяет tests/calc.mjs; здесь — что до него
       можно добраться и что он работает в настоящей странице: строка с
       единицами и погрешностью, кнопка «решить» у формулы в конспекте,
       ответ задачи с единицами и ответ не той размерности. */
    const выч = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      document.querySelector('#btn-calc').click(); await жди(150);
      out.открылся = !document.querySelector('#calc').classList.contains('hidden');
      const вход = document.querySelector('#calc-in');
      вход.value = '(2,5 ± 0,1) м / (3,0 ± 0,2) с'; вход.dispatchEvent(new Event('input')); await жди(200);
      out.счёт = document.querySelector('#calc-out .calc-res').textContent;
      вход.value = '2 м + 3 с'; вход.dispatchEvent(new Event('input')); await жди(200);
      out.ошибка = document.querySelector('#calc-out .calc-err').textContent;
      закрытьВычислитель();
      openTopic('mech.osc'); await жди(200);
      out.кнопокРешить = document.querySelectorAll('#pane .f-solve').length;
      // «решить» у маятника: T = 2π√(L/g), найдём g
      const i = S.topic.formulas.findIndex(f => /\\dfrac\{L\}\{g\}/.test(f.tex));
      document.querySelector(`#pane .f-solve[data-f="${i}"]`).click(); await жди(250);
      document.querySelector('#calc-unk .calc-v[data-v="g"]').click(); await жди(150);
      for (const inp of document.querySelectorAll('#calc-fields .calc-val')) {
        inp.value = inp.dataset.v === 'T' ? '(2,00 ± 0,01) с' : '(1,000 ± 0,005) м';
        inp.dispatchEvent(new Event('input'));
      }
      await жди(250);
      out.формула = document.querySelector('#calc-fres .calc-res').textContent.replace(/\s+/g, ' ');
      out.выражение = !!document.querySelector('#calc-fres .calc-ftex .katex');
      закрытьВычислитель();
      // задача: ответ с единицами и не той размерности
      document.querySelector('#tabs button[data-tab="problems"]').click(); await жди(250);
      const задача = document.querySelector('#pane .problem');
      const t = S.topic, pr = t.problems[+задача.dataset.i];
      const P = pr.sim ? rt(pr.sim).params : {};
      const верно = pr.answer(P);
      out.единица = pr.unit;
      const ввести = async текст => { задача.querySelector('input').value = текст; задача.querySelector('.check').click(); await жди(80);
        return задача.querySelector('.verdict').textContent; };
      // правильный ответ, но в тысячу раз более мелких единицах той же величины
      const мелкая = { 'м': 'мм', 'с': 'мс', 'кг': 'г', 'Н': 'мН', 'Дж': 'мДж', 'м/с': 'мм/с' }[pr.unit];
      out.сЕдиницами = мелкая ? await ввести(String(верно * 1000).replace('.', ',') + ' ' + мелкая) : 'нет подходящей единицы';
      out.неТа = await ввести('3 кг·м²');
      return out;
    });
    ok('вычислитель: единицы, погрешность и ошибка размерности в странице',
      выч.открылся && выч.счёт === '0,83 ± 0,06 м/с' && /одинаковое/.test(выч.ошибка), выч);
    ok('кнопка «решить» у формулы: g маятника с погрешностью',
      выч.кнопокРешить > 0 && /9,87 ± 0,11 м\/с²/.test(выч.формула) && выч.выражение, выч);
    ok('ответ задачи с единицами переводится, не та размерность названа',
      /верно/.test(выч.сЕдиницами) && /размерность не та/.test(выч.неТа), { сЕдиницами: выч.сЕдиницами, неТа: выч.неТа, единица: выч.единица });

    /* ПРОИЗВОДНАЯ И ИНТЕГРАЛ НА ГРАФИКАХ. Числа сверяет tests/graphs.mjs;
       здесь — что настоящий щелчок и протяжка мышью по холсту доходят до
       разбора. Историю набираем шагами расчёта, а не ожиданием: так
       быстрее и одинаково на любой машине. */
    const набрать = async (тема, сим, секунд) => {
      await p.evaluate(([тема, сим, секунд]) => {
        openTopic(тема); openSim(сим); S.playing = false;
        const a = A();
        for (let k = 0; k < секунд / DT; k++) { a.def.step(a.state, DT, a.params); if (++a.tick % 6 === 0) record(a); }
        drawGraphs();
      }, [тема, сим, секунд]);
      await p.waitForTimeout(100);
    };
    const холст = async n => { const c = (await p.$$('#gbox canvas.gcv'))[n]; await c.scrollIntoViewIfNeeded(); return c.boundingBox(); };
    const разбор = () => p.evaluate(() => document.querySelector('#g-an').innerText.replace(/\s+/g, ' '));
    await набрать('mech.1d', 'kin1d', 3);
    const подсказка = await разбор();
    let r = await холст(0);
    await p.mouse.click(r.x + r.width * 0.55, r.y + r.height / 2); await p.waitForTimeout(150);
    const касательная = await разбор();
    r = await холст(1);
    await p.mouse.move(r.x + r.width * 0.2, r.y + r.height / 2); await p.mouse.down();
    await p.mouse.move(r.x + r.width * 0.8, r.y + r.height / 2, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(150);
    const площадь = await разбор();
    ok('касание графика x(t): наклон сверен с v(t)',
      /Коснитесь графика/.test(подсказка) && /Касательная в момент/.test(касательная) &&
      /Наклон графика «x\(t\)»: [\d,−-]+ м\/с\. График «v\(t\)» в этот же момент: [\d,−-]+ м\/с — совпадает/.test(касательная), { подсказка, касательная });
    ok('протяжка по графику v(t): площадь сверена с изменением x(t)',
      /Площадь под графиком «v\(t\)»: [\d,−-]+ м\. Изменение величины «x\(t\)» за это время: [\d,−-]+ м — совпадает/.test(площадь), площадь);
    await набрать('mech.osc', 'pendulum', 3);
    r = await холст(0);
    await p.mouse.click(r.x + r.width * 0.4, r.y + r.height / 2); await p.waitForTimeout(150);
    const маятник = await разбор();
    ok('угол в градусах против угловой скорости в рад/с — через вычислитель', /рад\/с — совпадает/.test(маятник), маятник);
    await набрать('em.induction', 'lenz', 3);
    const ленц = await p.evaluate(() => {
      const a = A(); if (!a || a.def !== SIMS.lenz) return 'нет симуляции';
      // момент большой ЭДС, где сверка не вырождается в «0 = 0», — и не на
      // ступеньке: поток через рамку кусочно-линейный, на изломе наклон по
      // точкам неточен (и текст это признаёт), а на полке он точен
      const H = a.hist, э = k => H[k].v[1][0], ровно = k => [-3, -2, -1, 1, 2, 3].every(d => Math.abs(э(k + d) - э(k)) < 0.05 * Math.abs(э(k)));
      let i = -1;
      for (let k = 4; k < H.length - 4; k++) if (ровно(k) && (i < 0 || Math.abs(э(k)) > Math.abs(э(i)))) i = k;
      if (i < 0) return 'нет полки ЭДС';
      анализ = { вид: 'касательная', t1: H[i].t, g: 0 }; drawGraphs();
      return document.querySelector('#g-an').innerText.replace(/\s+/g, ' ');
    });
    ok('ЭДС = −dΦ/dt: наклон берётся с минусом', /взятый с минусом: [\d,−-]*[1-9]/.test(ленц) && /совпадает/.test(ленц), ленц);
    const сброс = await p.evaluate(() => { restart(A()); drawGraphs(); return document.querySelector('#g-an').innerText; });
    ok('сброс симуляции снимает разбор', /Коснитесь графика/.test(сброс), сброс);

    /* ============ 2.0.0 ============ */
    /* «Второй закон»: число тел задаёт n, поля bodies там нет. Группа
       «Тело 2» была зашита под bodies и не показывалась никогда. */
    await p.evaluate(() => { openTopic('mech.dyn'); openSim('newton2'); });
    const группыТел = () => p.evaluate(() => [...document.querySelectorAll('#params .pg-h span')].map(x => x.textContent).filter(x => /^Тело/.test(x)).join());
    const полеN = p.locator('#params .param[data-key="n"] input');
    await полеN.fill('3'); await полеN.press('Enter'); await p.waitForTimeout(150);
    const три = await группыТел();
    await полеN.fill('1'); await полеN.press('Enter'); await p.waitForTimeout(150);
    const одно = await группыТел();
    await полеN.fill('2'); await полеN.press('Enter'); await p.waitForTimeout(150);
    ok('динамика: при трёх телах видны параметры всех трёх, при одном — только первого',
      три === 'Тело 1,Тело 2,Тело 3' && одно === 'Тело 1' && (await группыТел()) === 'Тело 1,Тело 2', { три, одно });

    /* «Мой путь»: кнопка, пять вкладок, карта из 27 тем, Esc закрывает */
    await p.evaluate(() => { localStorage.removeItem('physim.journal'); журналУч = null; });
    await p.click('#btn-path'); await p.waitForTimeout(350);
    const путьВид = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      const r = { открыт: путьОткрыт(), вкладки: [...document.querySelectorAll('#path [data-pt]')].map(b => b.textContent) };
      r.старт = !!document.querySelector('#path .pt-start');
      document.querySelector('#path [data-pt="map"]').click(); await жди(150);
      r.узлов = document.querySelectorAll('#path .pm-n').length;
      r.фронт = [...document.querySelectorAll('#path .pm-n.front')].map(g => g.dataset.id);
      document.querySelector('#path .pm-n[data-id="mech.dyn"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await жди(100);
      r.карточка = (document.querySelector('#pm-card') || {}).textContent || '';
      document.querySelector('#path [data-pt="ask"]').click(); await жди(100);
      r.вопросов = document.querySelectorAll('#path .aq-i').length;
      return r;
    });
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const закрылся = await p.evaluate(() => !путьОткрыт());
    ok('«Мой путь»: пять вкладок, карта всех тем, фронт — начало курса, Esc закрывает',
      путьВид.открыт && путьВид.вкладки.join('|') === 'Сегодня|Карта|Диагностика|Навыки|От вопроса' && путьВид.старт &&
      путьВид.узлов === 27 && путьВид.фронт.join() === 'mech.1d' && /Одномерное движение/.test(путьВид.карточка) &&
      путьВид.вопросов >= 36 && закрылся, путьВид);

    /* Неверный ответ с перепутанными sin и cos узнаётся и записывается */
    const веер = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      for (const t of ALL) for (const [i, pr] of (t.problems || []).entries()) {
        if (!pr.sim || !SIMS[pr.sim]) continue;
        const P = rt(pr.sim).params, def = SIMS[pr.sim];
        const q = def.params.find(q => answerParams(pr, P).includes(q.key) && q.unit === '°' && P[q.key] !== 45 && P[q.key] !== 0);
        if (!q) continue;
        let v; try { v = pr.answer(Object.assign({}, P, { [q.key]: 90 - P[q.key] })); } catch (e) { continue; }
        if (!isFinite(v) || Math.abs(v - pr.answer(P)) <= Math.abs(pr.answer(P)) * 0.02) continue;
        openTopic(t.id); document.querySelector('#tabs button[data-tab="problems"]').click(); await жди(150);
        const el = document.querySelector(`#pane .problem[data-i="${i}"]`);
        el.querySelector('input').value = String(v); el.querySelector('.check').click(); await жди(80);
        const з = журнал().задачи[идЗадачи(t, pr)];
        return { тема: t.id, вердикт: el.querySelector('.verdict').textContent, разбор: (el.querySelector('.pr-fan') || {}).textContent || '',
          кнопка: !!el.querySelector('.pr-fan-go'), записано: !!з && з.п.length === 1 && з.п[0][2] === 'sin-cos',
          полоса: (document.querySelector('#t-path') || {}).textContent || '' };
      }
      return null;
    });
    ok('неверный ответ: «похоже, перепутаны sin и cos», попытка в журнале, полоса темы обновилась',
      веер && /sin и cos/.test(веер.разбор) && веер.кнопка && веер.записано && /в работе|трудности/.test(веер.полоса), веер);

    /* Диагностика целиком: двенадцать «не знаю» → совет начать с 1D */
    const диагн = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      localStorage.removeItem('physim.diagRun'); диаг = null;
      открытьПуть('diag'); await жди(100);
      document.querySelector('#dg-go').click(); await жди(80);
      let n = 0;
      while (document.querySelector('#path .pc-skip') && n < 20) {
        document.querySelector('#path .pc-skip').click(); await жди(30);
        document.querySelector('#path .pc-nextbtn').click(); await жди(30); n++;
      }
      const r = { задач: n, итог: (document.querySelector('#path .dg-res') || {}).textContent || '', хранится: !!журнал().диагн };
      закрытьПуть(); return r;
    });
    ok('диагностика: 12 задач и совет начать с «Одномерного движения»',
      диагн.задач === 12 && /Начните с темы «Одномерное движение»/.test(диагн.итог) && диагн.хранится, диагн);

    /* Тренажёр навыка: пять верных подряд чинят его */
    const трен = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      открытьПуть('skills', { навык: 'знак' }); await жди(100);
      for (let k = 0; k < 5; k++) {
        const inp = document.querySelector('#sk-train input');
        inp.value = String(тренажёр.упр.ответ).replace('.', ',');
        document.querySelector('#sk-train .sk-check').click(); await жди(40);
        if (k < 4) { document.querySelector('#sk-train .sk-check').click(); await жди(40); }
      }
      const r = { починен: !!(document.querySelector('#sk-train .sk-fixed')), журнал: журнал().тренажёр['знак'] };
      закрытьПуть(); return r;
    });
    ok('тренажёр: пять верных подряд — навык починен', трен.починен && трен.журнал.верно === 5, трен);

    /* «От вопроса» открывает тему и симуляцию */
    const вопрос = await p.evaluate(async () => {
      открытьПуть('ask'); await new Promise(r => setTimeout(r, 100));
      const b = [...document.querySelectorAll('#path .aq-i')].find(x => x.dataset.s === 'orbit'); b.click();
      await new Promise(r => setTimeout(r, 200));
      return { тема: S.topic.id, сим: S.active, закрыт: !путьОткрыт() };
    });
    ok('«От вопроса»: «Почему спутник не падает?» ведёт в гравитацию и орбиту', вопрос.тема === 'mech.grav' && вопрос.сим === 'orbit' && вопрос.закрыт, вопрос);

    /* Настройки: карточка темы, код обмена туда и обратно, профиль с возвратом */
    const настр = await p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      const было = JSON.stringify(S.settings);
      openPrefs('quick'); await жди(100);
      document.querySelector('[data-theme-id="oled"]').click(); await жди(50);
      const r = { палитра: document.documentElement.dataset.palette, тон: document.documentElement.dataset.theme };
      document.querySelector('[data-acc="teal"]').click(); await жди(50);
      r.акцент = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      r.оттенок = getComputedStyle(document.documentElement).getPropertyValue('--accent-300').trim();
      const код = кодНастроек(); r.код = /^PHYSIM1:/.test(код);
      S.settings = JSON.parse(было); applySettings();
      r.обратно = разобратьКод(код);
      let чужой = ''; try { разобратьКод('PHYSIM1:' + btoa('{"fs":"<img>","palette":"virus","theme":"dark"}')); } catch (e) { чужой = e.message; }
      r.чужой = разобратьКод('PHYSIM1:' + btoa('{"fs":"<img>","palette":"virus","theme":"dark"}'));
      openPrefs('quick'); await жди(50);
      document.querySelector('[data-prof="0"]').click(); await жди(50);
      r.проектор = prefGet('fs') === 15 && prefGet('palette') === 'contrast';
      document.querySelector('#q-undo').click(); await жди(50);
      r.вернули = prefGet('palette') === JSON.parse(было).palette || prefGet('palette') === 'std';
      r.сегменты = document.querySelectorAll('#prefs-body .seg').length;
      closePrefs(); S.settings = JSON.parse(было); applySettings();
      return r;
    });
    ok('настройки: тема карточкой, производные оттенки акцента, код обмена, профиль и «вернуть как было»',
      настр.палитра === 'oled' && настр.тон === 'dark' && настр.акцент === '#0d9488' && настр.оттенок && настр.оттенок !== '#d2cefd' &&
      настр.код && настр.обратно.palette === 'oled' && настр.обратно.accent === 'teal' &&
      настр.чужой.theme === 'dark' && !('fs' in настр.чужой) && !('palette' in настр.чужой) &&
      настр.проектор && настр.вернули && настр.сегменты >= 4, настр);

    /* журнал сливается из файла, а не затирается */
    const слияние = await p.evaluate(() => {
      const ж = журнал(), n0 = Object.keys(ж.задачи).length;
      const чужой = УЧ.новыйЖурнал();
      УЧ.записатьПопытку(чужой, { тема: 'mech.1d', задача: 'чужая#1', уровень: 2, ok: true, t: 1 });
      слитьЖурнал(JSON.parse(JSON.stringify(чужой)));
      return { было: n0, стало: Object.keys(журнал().задачи).length };
    });
    ok('прогресс из файла сливается с текущим', слияние.стало === слияние.было + 1, слияние);

    /* ============ 2.1.0 ============ */
    /* Диалог подтверждения жил под настройками (z-index 80 против 140):
       «Сбросить настройки» открывал окно, которого не видно. */
    await p.evaluate(() => { S.settings.fs = 14; applySettings(); openPrefs('data'); });
    await p.click('#pref-reset-all'); await p.waitForTimeout(200);
    const диалог = await p.evaluate(() => {
      const m = document.querySelector('#modal-ask .modal').getBoundingClientRect();
      const el = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
      return { поверх: !!el && !!el.closest('#modal-ask'), фокус: document.activeElement && document.activeElement.id };
    });
    await p.click('#ask-ok'); await p.waitForTimeout(150);
    const послеСброса = await p.evaluate(() => {
      // сообщение пропускает указатель насквозь, поэтому elementFromPoint его не видит:
      // сверяем, что оно показано и лежит слоем выше настроек
      const t = document.querySelector('#toast'), z = el => +getComputedStyle(el).zIndex;
      const r = { fs: prefGet('fs'), сообщениеВидно: t.classList.contains('show') && z(t) > z(document.querySelector('#prefs')), вернуть: !!LS.get('prefsUndo', null) };
      closePrefs(); return r;
    });
    ok('диалог «Сбросить настройки?» поверх настроек, сброс работает, сообщение видно над настройками',
      диалог.поверх && диалог.фокус === 'ask-ok' && послеСброса.fs === 12 && послеСброса.сообщениеВидно && послеСброса.вернуть, { диалог, послеСброса });

    /* Цвет и значок раздела: дерево, шапка темы, сводка, полоса чтения */
    const раздел = await p.evaluate(async () => {
      openTopic('th.kinetic'); await new Promise(r => setTimeout(r, 150));
      const sec = [...document.querySelectorAll('#tree .sec')].find(x => /МКТ/.test(x.textContent));
      const pane = document.querySelector('#pane');
      pane.scrollTop = (pane.scrollHeight - pane.clientHeight) / 2; pane.dispatchEvent(new Event('scroll'));
      await new Promise(r => setTimeout(r, 120));
      const ch = document.querySelector('.chead');
      return { деревоЦвет: sec && sec.classList.contains('sx') && !!sec.querySelector('.sec-ic'),
        цвет: getComputedStyle(ch).getPropertyValue('--sec').trim(), значок: !!document.querySelector('#t-ic svg'),
        сводка: document.querySelector('#t-meta').textContent.replace(/\s+/g, ' ').trim(),
        чтение: document.querySelector('#readbar i').style.transform, наверх: !document.querySelector('.to-top').classList.contains('hidden') };
    });
    ok('раздел в цвете: значок в дереве и шапке, сводка темы, полоса чтения и «наверх»',
      раздел.деревоЦвет && раздел.цвет === '#ea580c' && раздел.значок && /мин/.test(раздел.сводка) && /15 задач/.test(раздел.сводка) &&
      /scaleX\(0\.[1-9]/.test(раздел.чтение) && раздел.наверх, раздел);

    /* Главный экран: при запуске, разделы открывают первую неосвоенную тему */
    {
      const hp = await b.newPage({ viewport: { width: 1400, height: 900 } });
      const hErrs = []; hp.on('pageerror', e => hErrs.push(e.message));
      await hp.route('**cdnjs.cloudflare.com**', r => r.abort());
      await hp.goto(url); await hp.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {}); await hp.waitForTimeout(500);
      const главная = await hp.evaluate(() => ({ видна: главнаяОткрыта(), разделов: document.querySelectorAll('#home .hm-sec').length,
        цвета: [...document.querySelectorAll('#home .hm-sec')].map(x => getComputedStyle(x).getPropertyValue('--sec').trim()),
        поиск: !!document.querySelector('#hm-search'), вопрос: !!document.querySelector('#home .hm-q') }));
      await hp.click('#home .hm-sec[data-sec="optics"]'); await hp.waitForTimeout(250);
      const тема = await hp.evaluate(() => ({ тема: S.topic.id, скрыта: !главнаяОткрыта() }));
      await hp.click('#btn-home'); await hp.waitForTimeout(200);
      const снова = await hp.evaluate(() => ({ видна: главнаяОткрыта(), продолжить: (document.querySelector('#home .hm-cont') || {}).textContent || '' }));
      await hp.evaluate(() => { S.settings.startScreen = 'last'; applySettings(); });
      await hp.reload(); await hp.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {}); await hp.waitForTimeout(500);
      const безГлавной = await hp.evaluate(() => ({ видна: главнаяОткрыта(), тема: S.topic.id }));
      ok('главный экран: 6 разделов в своих цветах, раздел ведёт в тему, «Главная» возвращает, настройка «сразу тема»',
        главная.видна && главная.разделов === 6 && new Set(главная.цвета).size === 6 && главная.поиск && главная.вопрос &&
        тема.тема === 'op.matter' && тема.скрыта && снова.видна && /Взаимодействие излучения/.test(снова.продолжить) &&
        !безГлавной.видна && безГлавной.тема === 'op.matter' && hErrs.length === 0, { главная, тема, снова, безГлавной, hErrs });

      /* «Очистить всё»: стирает хранилище и кэш офлайн-копии и перезапускает.
         Раньше состояние в памяти тут же записывалось обратно. */
      await hp.evaluate(() => { S.solved['x#1'] = 1; LS.set('solved', S.solved); отметитьПопытку(ALL[1], ALL[1].problems[0], true, [], 'тест');
        openPrefs('data'); document.querySelector('#pref-clear-all').click(); });
      await hp.waitForTimeout(150);
      const красная = await hp.evaluate(() => document.querySelector('#ask-ok').classList.contains('danger') && document.activeElement.id === 'ask-cancel');
      await Promise.all([hp.waitForNavigation({ timeout: 8000 }).catch(() => null), hp.click('#ask-ok')]);
      await hp.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {}); await hp.waitForTimeout(500);
      const чисто = await hp.evaluate(() => {
        const ключи = []; for (let i = 0; i < localStorage.length; i++) ключи.push(localStorage.key(i));
        return { решено: Object.keys(S.solved).length, журнал: Object.keys(журнал().задачи).length,
          ключи: ключи.filter(k => /^physim\.(solved|journal|settings)$/.test(k) && localStorage.getItem(k) !== '{}' && !/"задачи":\{\}/.test(localStorage.getItem(k))),
          главная: главнаяОткрыта(), готов: window.PHYSIM_READY === true };
      });
      ok('«Очистить всё»: красная кнопка, фокус на «Отмена», после перезапуска прогресса нет и пособие работает',
        красная && чисто.решено === 0 && чисто.журнал === 0 && чисто.главная && чисто.готов && hErrs.length === 0, { красная, чисто, hErrs });
      await hp.close();
    }

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

    /* Карточка приёма на телефоне: рядом с меткой в узкой колонке ей не
       поместиться, поэтому это нижний лист во всю ширину — и он обязан лечь
       поверх нижних панелей, а не под них (так уже было с настройками). */
    const приёмТел = await m.p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      openTopic('mech.osc'); await жди(300);
      setSheetTab('notes'); await жди(400);
      const d = document.querySelector('#pane .deriv[data-d="1"]');
      d.querySelector('.dv-all').click();
      const чип = d.querySelector('.dv-step[data-k="1"] .op-chip');
      чип.scrollIntoView({ block: 'center' }); await жди(100);
      чип.click(); await жди(250);
      const c = document.querySelector('#opcard'), r = c.getBoundingClientRect();
      const внизу = document.elementFromPoint(r.left + r.width / 2, r.bottom - 12);
      const out = { лист: c.classList.contains('sheet'), отступСнизу: Math.round(innerHeight - r.bottom),
                    воВсюШирину: Math.round(r.width) === innerWidth, поверх: !!внизу && c.contains(внизу),
                    высота: Math.round(r.height), экран: innerHeight };
      закрытьПриём();
      return out;
    });
    const вычТел = await m.p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      закрытьПриём();
      открытьВычислитель({ вкладка: 'expr' }); await жди(450);   // панель въезжает снизу за 0,32 с
      const c = document.querySelector('#calc').getBoundingClientRect();
      const вход = document.querySelector('#calc-in');
      вход.value = '72 км/ч в м/с'; вход.dispatchEvent(new Event('input')); await жди(200);
      const r = { во_весь_экран: Math.round(c.width) === innerWidth && Math.round(c.bottom) === innerHeight && c.top <= 1,
        поверх: document.elementFromPoint(innerWidth / 2, innerHeight - 20).closest('#calc') !== null,
        ответ: (document.querySelector('#calc-out .calc-res') || {}).textContent };
      закрытьВычислитель();
      return r;
    });
    ok('на телефоне вычислитель во весь экран поверх панелей', вычТел.во_весь_экран && вычТел.поверх && вычТел.ответ === '20 м/с', вычТел);

    /* касание графика пальцем на телефоне: разбор появляется под графиками */
    await m.p.evaluate(() => {
      openTopic('mech.osc'); openSim('spring'); openSimMobile(); S.playing = false;
      const a = A();
      for (let k = 0; k < 3 / DT; k++) { a.def.step(a.state, DT, a.params); if (++a.tick % 6 === 0) record(a); }
      setSheetTab('params'); setDetent('full'); drawGraphs();
      document.querySelector('#gbox canvas.gcv').scrollIntoView({ block: 'center' });
    });
    await m.p.waitForTimeout(400);
    const гк = await (await m.p.$('#gbox canvas.gcv')).boundingBox();
    await m.p.touchscreen.tap(гк.x + гк.width * 0.5, гк.y + гк.height / 2); await m.p.waitForTimeout(400);
    const графТел = await m.p.evaluate(() => {
      const box = document.querySelector('#g-an'), r = box.getBoundingClientRect();
      return { текст: box.innerText.replace(/\s+/g, ' '), виден: r.height > 0 && r.top < innerHeight && r.bottom > 0 };
    });
    ok('на телефоне касание графика даёт касательную и сверку', графТел.виден && /Касательная в момент/.test(графТел.текст) && /совпадает/.test(графТел.текст), графТел);

    /* 2.0.0 на телефоне: «Мой путь» во весь экран; закрытие сцены
       возвращает конспект (раньше при закрытии не через кнопку оставался
       пустой белый экран) */
    const путьТел = await m.p.evaluate(async () => {
      const жди = ms => new Promise(r => setTimeout(r, ms));
      открытьПуть('today'); await жди(400);
      const b = document.querySelector('#path .path-box').getBoundingClientRect();
      const r = { весь: Math.round(b.width) === innerWidth && Math.round(b.height) >= innerHeight - 2, значок: !!document.querySelector('#m-path') };
      document.querySelector('#path [data-pt="map"]').click(); await жди(200);
      const svg = document.querySelector('#path svg.pm').getBoundingClientRect();
      r.картаВлезла = svg.width <= innerWidth;
      закрытьПуть();
      openTopic('mech.dyn'); openSim('newton2'); openSimMobile(); await жди(200);
      closeSimMobile(); await жди(300);
      const c = document.querySelector('#content').getBoundingClientRect();
      r.конспект = c.height > 300 && getComputedStyle(document.querySelector('#content')).display !== 'none';
      return r;
    });
    ok('телефон: «Мой путь» во весь экран, карта в ширину экрана, после закрытия сцены виден конспект',
      путьТел.весь && путьТел.значок && путьТел.картаВлезла && путьТел.конспект, путьТел);
    ok('на телефоне карточка приёма — нижний лист поверх панелей',
      приёмТел.лист && приёмТел.отступСнизу === 0 && приёмТел.воВсюШирину &&
      приёмТел.поверх && приёмТел.высота <= приёмТел.экран * 0.8, приёмТел);

    await m.p.close();

    await планшеты(b, url, label);
    await повторныйЗапуск(b, url, label, label === 'исходники');
  }

  await сторож(b);

  await b.close(); server.close();
  console.log('\n' + (fails.length ? 'ПРОВАЛЕНО: ' + fails.join(' | ') : 'всё прошло'));
  process.exit(fails.length ? 1 : 0);
})();
