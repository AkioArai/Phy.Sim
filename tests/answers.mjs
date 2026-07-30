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
                   всегдаNaN:[], сЭкрана:[], сЭкранаУр1:[], чужойКлюч:[], мёртваяВетка:[],
                   единицы:[], постоянные:[], безОтвета:[] };

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

    /* МЁРТВАЯ ВЕТКА. Ответ сравнивает параметр-переключатель со строкой, которой
       нет среди его значений: ветка недостижима, и для соответствующего варианта
       выдаётся ответ от другого. Так задача про линзу считала рассеивающую
       собирающей, потому что в симуляции значение 'div', а в ответе 'diverging'. */
    {
      const разрешено = new Set();
      for (const q of def.params || []) for (const o of q.options || []) разрешено.add(o.v);
      const src = pr.answer.toString();
      for (const m of new Set([...src.matchAll(/(['"])([A-Za-z][A-Za-z0-9_]*)\1/g)].map(x => x[2])))
        if (!разрешено.has(m)) issues.мёртваяВетка.push(`${где}: сравнение с «${m}», а у симуляции значения [${[...разрешено].join(', ')}]`);
    }

    /* ЕДИНИЦЫ. Если ответ пропорционален ровно одному параметру с коэффициентом-
       числом, то его единица обязана быть согласована с единицей параметра.
       Расхождение бывает и законным (энергия связи = 8,8 МэВ · A), поэтому это
       сводка для сверки глазами, а не ошибка. Именно так нашлись «мкс» вместо
       «мс» у τ = RC и «см» вместо «м» у линзы. */
    {
      const def0 = defaults(def);
      const единицы = {};
      for (const q of def.params) if (q.type !== 'group') единицы[q.key] = q.unit || '';
      const свои = [...прочитаны].filter(k => объявлены.has(k) && typeof def0[k] === 'number');
      if (свои.length === 1) {
        const k = свои[0];
        try {
          const a = pr.answer(def0);
          const p2 = { ...def0 }; p2[k] = def0[k] * 2;
          const bq = pr.answer(p2);
          if (Number.isFinite(a) && Number.isFinite(bq) && a !== 0 && Math.abs(bq / a - 2) < 1e-9) {
            const ед = единицы[k] || '—';
            if (ед !== (pr.unit || '—'))
              issues.единицы.push(`${где}: ответ = ${(a / def0[k]).toPrecision(4)} · ${k} [${ед}], а единица задачи «${pr.unit}»`);
          }
        } catch (_) {}
      }
    }

    const уникальные = new Set(значения.map(v => v.toPrecision(9)));
    if (уникальные.size === 1 && значения.length > 3)
      issues.постоянные.push(`${где} = ${значения[0]} ${pr.unit}`);

    /* Совпадает ли ответ с числом, которое и так видно на экране? Тогда
       задача решается чтением панели, а не физикой.

       ВАЖНО: показание — это МАССИВ [подпись, значение, единица], а не
       объект. Проверка сначала смотрела r.v и r.k, которых не существует,
       поэтому условие никогда не выполнялось и «0 совпадений» ничего не
       означал. Совпадение считаем подозрительным только если оно держится
       на ВСЕХ наборах параметров: разовое совпадение чисел — случайность. */
    if (def.readouts) {
      try {
        const наборыДляЭкрана = [defaults(def), ...наборы.slice(1, 6)];
        let подпись = null, совпалоВезде = true, сравнений = 0, шаг = 0;
        for (const p of наборыДляЭкрана) {
          const эталон = pr.answer(p);
          if (!Number.isFinite(эталон) || эталон === 0) continue;
          /* Каждый набор прогоняем РАЗНОЕ время. Иначе показание «t» у всех
             наборов одинаково (ровно 1 с), и любая задача с постоянным
             ответом 1 «совпадает с часами» — ложная тревога. */
          const кадров = 90 + 37 * (шаг++);
          let st = def.init(p);
          for (let i = 0; i < кадров; i++) def.step(st, 1 / 120, p);
          const rs = def.readouts(st, p) || [];
          let нашли = null;
          for (const r of rs) {
            const [подп, знач] = Array.isArray(r) ? r : [r.label, r.v];
            if (typeof знач !== 'number' || !Number.isFinite(знач)) continue;
            if (Math.abs(знач - эталон) <= Math.abs(эталон) * READOUT_TOL) { нашли = подп; break; }
          }
          сравнений++;
          if (!нашли || (подпись && нашли !== подпись)) { совпалоВезде = false; break; }
          подпись = нашли;
        }
        /* Задачи уровня 1 — «оглядеться»: они и должны решаться сверкой с
           панелью, там смысл в том, чтобы найти нужную величину среди прочих.
           Дефект — это когда с панели списывается задача уровня 2 и выше. */
        if (совпалоВезде && сравнений >= 3 && подпись) {
          const строка = `${где}: совпадает с показанием «${подпись}» на всех наборах`;
          (pr.level <= 1 ? issues.сЭкранаУр1 : issues.сЭкрана).push(строка);
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
  сЭкрана:       'Ответ уровня 2+ совпадает с показанием на экране',
  сЭкранаУр1:    'Ответ уровня 1 совпадает с показанием (так и задумано)',
  чужойКлюч:     'answer читает параметр, которого у симуляции нет',
  мёртваяВетка:  'answer сравнивает переключатель с несуществующим значением',
  единицы:       'Ответ пропорционален одному параметру — сверьте единицы',
  постоянные:    'Ответ не зависит от параметров (у всех учеников одинаков)',
  безОтвета:     'Ответ не определён при некоторых допустимых параметрах',
};
/* Мягкие категории — не дефекты, а сводка: постоянный ответ, прочерк при
   крайних параметрах и списываемая с панели задача уровня 1 бывают
   правильными по замыслу. Печатаем, но прогон не валим. */
const МЯГКИЕ = new Set(['постоянные', 'безОтвета', 'сЭкранаУр1', 'единицы']);

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
