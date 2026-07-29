/* Аудит ответов к задачам.
   ========================
   Ответы к 380 задачам не записаны числом — они вычисляются из текущих
   параметров симуляции. Это и есть главная ценность пособия (у соседа по
   парте другие числа), и главный риск: ошибку в такой формуле глазами не
   увидишь, а проверить её можно только прогоном.

   Что проверяется по каждой задаче:

     1) задача заполнена: есть условие, единица, уровень, существующая
        симуляция и answer-функция;
     2) answer не падает ни на умолчаниях, ни на 40 случайных наборах
        параметров из объявленных диапазонов;
     3) ответ — число, а не строка или undefined;
     4) ответ достижим: хотя бы на одном наборе получается конечное число.
        Задача, всегда дающая NaN, не решается вовсе;
     5) ответ не совпадает с показанием на экране: иначе задача решается
        чтением панели показателей, а не физикой.

   Отдельно, уже не ошибками, а сводкой для глаз:

     • ответ, не зависящий от параметров, — у соседа по парте будет тот же.
       Это бывает намеренно (работа силы натяжения ровно ноль; числа заданы
       прямо в условии), поэтому список печатается, но прогон не валит;
     • ответ, не определённый при некоторых допустимых параметрах. Тоже
       бывает верным: при коэффициенте восстановления 1 путь и правда
       бесконечен. Полезно знать, где ученик увидит прочерк.

   Порог «слишком большого числа» намеренно убран: при сильном затухании
   амплитуда честно падает в 10¹² раз, и всякая граница ловила бы физику,
   а не ошибки.

   Запуск:  npm i -D playwright && npm run audit
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
               '.woff2':'font/woff2', '.woff':'font/woff' };
const server = createServer(async (q, s) => {
  try {
    const p = join(ROOT, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
    s.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    s.end(await readFile(p));
  } catch { s.writeHead(404); s.end(); }
});

const PORT = 8981;
const SAMPLES = 40;          // наборов параметров на задачу
const READOUT_TOL = 1e-9;    // относительная близость к показанию на экране

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(400);

const report = await page.evaluate(({ SAMPLES, READOUT_TOL }) => {
  /* Детерминированный генератор: прогон должен быть воспроизводимым, иначе
     «иногда падает» невозможно расследовать. */
  let seed = 20260729;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  const problems = [];
  for (const t of ALL) for (const [i, pr] of (t.problems || []).entries())
    problems.push({ topic: t.id, idx: i, pr });

  const issues = { пустые:[], нетСимуляции:[], падают:[], неЧисло:[],
                   всегдаNaN:[], сЭкрана:[], чужойКлюч:[], постоянные:[], безОтвета:[] };

  // случайный набор параметров в объявленных границах
  const sample = def => {
    const p = {};
    for (const q of def.params) {
      if (q.type === 'group') continue;
      if (q.type === 'select') {
        const o = q.options || [];
        p[q.key] = o.length ? o[Math.floor(rnd() * o.length)].v : q.default;
      } else if (q.type === 'toggle' || typeof q.default === 'boolean') {
        p[q.key] = rnd() < 0.5;
      } else if (typeof q.min === 'number' && typeof q.max === 'number') {
        const v = q.min + rnd() * (q.max - q.min);
        p[q.key] = q.step ? Math.round(v / q.step) * q.step : v;
      } else p[q.key] = q.default;
    }
    return p;
  };
  const defaults = def => {
    const p = {};
    for (const q of def.params) if (q.type !== 'group') p[q.key] = q.default;
    return p;
  };

  for (const { topic, idx, pr } of problems) {
    const где = `${topic}#${idx + 1}`;

    /* unit:'' — законно: у безразмерного коэффициента единицы нет. Требуем
       только, чтобы поле было строкой, а не забытым undefined. */
    if (!pr.statement || typeof pr.unit !== 'string' || !pr.level) { issues.пустые.push(где); continue; }
    const def = SIMS[pr.sim];
    if (!def) { issues.нетСимуляции.push(`${где} → ${pr.sim}`); continue; }
    if (typeof pr.answer !== 'function') { issues.пустые.push(где + ' (нет answer)'); continue; }

    const значения = [];
    let упал = null, неЧисло = false, неопределённых = 0;

    const наборы = [defaults(def)];
    for (let k = 0; k < SAMPLES; k++) наборы.push(sample(def));

    for (const p of наборы) {
      let v;
      try { v = pr.answer(p); }
      catch (e) { упал = e.message; break; }
      if (typeof v !== 'number') { неЧисло = true; break; }
      // NaN и ±Infinity — законные ответы «события не будет» и «бесконечно»;
      // приложение показывает и то, и другое прочерком
      if (Number.isFinite(v)) значения.push(v); else неопределённых++;
    }

    if (упал)      { issues.падают.push(`${где}: ${упал}`); continue; }
    if (неЧисло)   { issues.неЧисло.push(где); continue; }
    if (!значения.length) { issues.всегдаNaN.push(где); continue; }
    if (неопределённых)
      issues.безОтвета.push(`${где}: прочерк на ${неопределённых} из ${наборы.length} наборов`);

    /* Читает ли answer параметр, которого у симуляции нет? Такой ключ даёт
       undefined, и формула тихо считает мусор. Ловушка Proxy показывает
       ровно те обращения, что были. */
    const объявлены = new Set(def.params.filter(q => q.type !== 'group').map(q => q.key));
    const прочитаны = new Set();
    try {
      pr.answer(new Proxy(defaults(def), {
        get(t, k) { if (typeof k === 'string') прочитаны.add(k); return t[k]; } }));
    } catch (_) {}
    const чужие = [...прочитаны].filter(k => !объявлены.has(k) &&
      !['toString','valueOf','then','constructor'].includes(k));
    if (чужие.length) issues.чужойКлюч.push(`${где}: ${чужие.join(', ')}`);

    const уникальные = new Set(значения.map(v => v.toPrecision(9)));
    if (уникальные.size === 1 && значения.length > 3)
      issues.постоянные.push(`${где} = ${значения[0]} ${pr.unit}`);

    /* Совпадает ли ответ с числом, которое и так видно на экране?
       Считаем показания на умолчаниях после короткого прогона. */
    if (def.readouts) {
      try {
        const p = defaults(def);
        let st = def.init(p);
        for (let i = 0; i < 120; i++) def.step(st, 1 / 120, p);
        const эталон = pr.answer(p);
        if (Number.isFinite(эталон) && эталон !== 0) {
          for (const r of def.readouts(st, p) || []) {
            if (typeof r.v === 'number' && Number.isFinite(r.v) &&
                Math.abs(r.v - эталон) <= Math.abs(эталон) * READOUT_TOL) {
              issues.сЭкрана.push(`${где}: совпадает с «${r.k || r.label || '?'}»`);
              break;
            }
          }
        }
      } catch (_) { /* показания могут требовать холста — не повод падать */ }
    }
  }

  return { всего: problems.length, issues };
}, { SAMPLES, READOUT_TOL });

await browser.close();
server.close();

/* ---------- отчёт ---------- */
const ЯРЛЫКИ = {
  пустые:        'Не заполнены (условие, единица, уровень или answer)',
  нетСимуляции:  'Ссылаются на несуществующую симуляцию',
  падают:        'answer падает с исключением',
  неЧисло:       'answer возвращает не число',
  всегдаNaN:     'Ответ никогда не определён — задача нерешаема',
  сЭкрана:       'Ответ совпадает с показанием на экране',
  чужойКлюч:     'answer читает параметр, которого у симуляции нет',
  постоянные:    'Ответ не зависит от параметров (у всех учеников одинаков)',
  безОтвета:     'Ответ не определён при некоторых допустимых параметрах',
};
/* Две последние категории — не дефекты, а сводка: и постоянный ответ, и
   прочерк при крайних параметрах бывают физически правильными. Печатаем,
   но прогон не валим. */
const МЯГКИЕ = new Set(['постоянные', 'безОтвета']);

console.log(`Проверено задач: ${report.всего}\n`);
let жёстких = 0, мягких = 0;
for (const [k, list] of Object.entries(report.issues)) {
  if (!list.length) { console.log(`  ok   ${ЯРЛЫКИ[k]}: 0`); continue; }
  const мягкий = МЯГКИЕ.has(k);
  мягкий ? (мягких += list.length) : (жёстких += list.length);
  console.log(`  ${мягкий ? 'ВНИМ ' : 'ОШИБ '} ${ЯРЛЫКИ[k]}: ${list.length}`);
  for (const s of list.slice(0, 12)) console.log(`         · ${s}`);
  if (list.length > 12) console.log(`         … и ещё ${list.length - 12}`);
}
if (pageErrors.length) { жёстких += pageErrors.length; console.log('\nОшибки страницы:', pageErrors.slice(0, 5)); }

console.log(жёстких ? `\nОШИБОК: ${жёстких}` : `\nошибок нет${мягких ? `, предупреждений ${мягких}` : ''}`);
process.exit(жёстких ? 1 : 0);
