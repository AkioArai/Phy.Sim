// Совместимость со старыми движками — без браузера, за секунду.
//
// Пособием пользуются на планшетах, где браузер или встроенный WebView не
// обновлялся годами: приложение ставят в обход магазина именно там, где
// магазина нет, а вместе с ним нет и обновлений WebView. До 1.8.0 в app.js
// стояла одна запись `?.`, и на Chrome/WebView младше 80 и Safari младше 13.1
// скрипт не разбирался целиком: пособие показывало картинку и больше ничего.
// Тем же `?.` был написан сторож страницы, так что объяснить случившееся
// было некому.
//
// Поэтому здесь не «хорошо бы», а граница, которую нельзя переступить:
//   • скрипты пособия — синтаксис ES2017 (Chrome 58, Safari 11);
//   • встроенный скрипт страницы (сторож) — ES5: он обязан дожить до конца
//     на любом движке, чтобы сказать человеку, что обновить;
//   • из библиотеки — только то, что есть в Chrome 58 и Safari 13;
//   • стили: без `inset` (Chrome 87), а у объявлений с color-mix, min(),
//     max(), clamp() и dvh — запасное объявление того же свойства перед ними.
//
//   node tests/compat.js      (входит в npm test)
const fs = require('fs'), path = require('path');
const acorn = require('./vendor/acorn.js');
const ROOT = path.resolve(__dirname, '..');
const читать = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const беды = [];
const ok = (имя, список) => {
  console.log((список.length ? '  FAIL ' : '  ok   ') + имя);
  for (const b of список.slice(0, 8)) console.log('         · ' + b);
  if (список.length > 8) console.log(`         … и ещё ${список.length - 8}`);
  if (список.length) беды.push(имя);
};

/* Обход дерева без acorn-walk: достаточно пройти по всем полям-узлам. */
function обойти(узел, f) {
  if (!узел || typeof узел.type !== 'string') return;
  f(узел);
  for (const k of Object.keys(узел)) {
    const v = узел[k];
    if (Array.isArray(v)) v.forEach(x => обойти(x, f));
    else if (v && typeof v.type === 'string') обойти(v, f);
  }
}

const файлы = ['js/core.js', 'js/topics.js', 'js/ops.js', 'js/learn.js', 'js/path.js', 'js/home.js', 'js/app.js', 'sw.js',
  ...fs.readdirSync(path.join(ROOT, 'js/sims')).map(f => 'js/sims/' + f)]
  .concat(fs.existsSync(path.join(ROOT, 'js/calc.js')) ? ['js/calc.js'] : []);

/* ---------- 1. синтаксис ES2017 ---------- */
{
  const плохо = [];
  const деревья = {};
  for (const f of файлы) {
    try { деревья[f] = acorn.parse(читать(f), { ecmaVersion: 2017, locations: true }); }
    catch (e) { плохо.push(`${f}: ${e.message} — синтаксис новее ES2017`); }
  }
  ok('скрипты разбираются как ES2017 (Chrome 58, Safari 11)', плохо);

  /* ---------- 2. библиотека: только то, что есть в Chrome 58 и Safari 13 ---------- */
  const НЕЛЬЗЯ = {
    flatMap: 'Chrome 69', flat: 'Chrome 69', at: 'Chrome 92, Safari 15.4', replaceAll: 'Chrome 85',
    fromEntries: 'Chrome 73', matchAll: 'Chrome 73', allSettled: 'Chrome 76', finally: 'Chrome 63',
    findLast: 'Chrome 97', findLastIndex: 'Chrome 97', hasOwn: 'Chrome 93', roundRect: 'Chrome 99',
    replaceChildren: 'Chrome 86', structuredClone: 'Chrome 98', randomUUID: 'Chrome 92',
    toSorted: 'Chrome 110', toReversed: 'Chrome 110', groupBy: 'Chrome 117',
  };
  /* Имена методов совпадают с полями наших объектов (у записи графика есть
     поле `at`), поэтому ловим только вызовы: x.flatMap(…), а не x.at. */
  const нельзя = имя => Object.prototype.hasOwnProperty.call(НЕЛЬЗЯ, имя);
  const вызовы = [];
  for (const [f, д] of Object.entries(деревья)) {
    обойти(д, n => {
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed &&
          нельзя(n.callee.property.name))
        вызовы.push(`${f}:${n.loc.start.line} .${n.callee.property.name}() — ${НЕЛЬЗЯ[n.callee.property.name]}`);
      // Blob.text() — Chrome 76, Safari 14; наши .text — это поля, а не вызовы
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed &&
          n.callee.property.name === 'text' && n.arguments.length === 0)
        вызовы.push(`${f}:${n.loc.start.line} .text() у файла — Chrome 76, Safari 14; есть текстФайла()`);
      // new ResizeObserver без проверки — Chrome 64, Safari 13.1
      if (n.type === 'NewExpression' && n.callee.name === 'ResizeObserver') {
        const строка = читать(f).split('\n')[n.loc.start.line - 1];
        if (!/window\.ResizeObserver/.test(строка))
          вызовы.push(`${f}:${n.loc.start.line} new ResizeObserver без проверки window.ResizeObserver`);
      }
    });
  }
  ok('из библиотеки — только то, что есть в Chrome 58 и Safari 13', вызовы);
}

/* ---------- 3. встроенные скрипты страницы — ES5 ---------- */
{
  const плохо = [];
  const html = читать('index.html');
  const re = /<script>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    try { acorn.parse(m[1], { ecmaVersion: 5 }); }
    catch (e) { плохо.push(`встроенный скрипт №${n}: ${e.message}`); }
  }
  if (!n) плохо.push('в index.html не нашлось сторожа загрузки');
  ok('сторож страницы написан на ES5 и доживёт на любом движке', плохо);
}

/* ---------- 4. стили ---------- */
{
  const css = читать('css/style.css');
  const безИнсета = [], безЗапаса = [];
  // объявления внутри самых вложенных блоков
  const блоки = css.match(/\{[^{}]*\}/g) || [];
  const разбить = тело => {
    const out = []; let d = 0, cur = '';
    for (const ch of тело) {
      if (ch === '(') d++; else if (ch === ')') d--;
      if (ch === ';' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.replace(/\/\*[\s\S]*?\*\//g, '').trim()).filter(Boolean);
  };
  const НОВОЕ = /color-mix\(|(^|[^\w-])(min|max|clamp)\(|\ddvh/;
  for (const б of блоки) {
    const decl = разбить(б.slice(1, -1));
    decl.forEach((d, i) => {
      const m = /^([-a-z]+)\s*:\s*([\s\S]*)$/.exec(d); if (!m) return;
      const [, prop, val] = m;
      if (prop === 'inset') безИнсета.push(d.slice(0, 60));
      if (prop.startsWith('--')) return;
      if (НОВОЕ.test(val)) {
        const было = decl.slice(0, i).map(x => (/^([-a-z]+)\s*:/.exec(x) || [])[1]);
        if (!было.includes(prop)) безЗапаса.push(d.slice(0, 70));
      }
    });
  }
  ok('в стилях нет inset (Chrome 87, Safari 14.1)', безИнсета);
  ok('у color-mix, min(), max(), clamp() и dvh есть запасное объявление', безЗапаса);
}

console.log(беды.length ? `\nсовместимость нарушена: ${беды.length}` : '\nсовместимость со старыми движками соблюдена');
process.exit(беды.length ? 1 : 0);
