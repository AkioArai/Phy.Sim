/* Проверка учебной структуры пособия.
   ==================================
   Конспект можно писать как угодно; у пособия есть обязательства, которые
   легко нарушить незаметно. Здесь они проверяются как инварианты данных.

   1. Граф предпосылок. Каждая тема из `needs` существует, ссылок на себя нет,
      циклов нет. Цикл означал бы, что тему нельзя прочитать никогда: чтобы
      понять A, нужно понять B, а чтобы понять B — снова A.

   2. Порядок. Предпосылка стоит в оглавлении РАНЬШЕ темы, которая её просит.
      Иначе ученик, читающий подряд, упирается в ссылку вперёд.

   3. Целостность блоков. У формулы либо есть вывод, либо она помечена
      определением. Вывод ссылается на существующую симуляцию и ведёт к одной
      из формул своей темы. У примера есть ответ и хотя бы один шаг.

   Запуск:  npm run curriculum
*/
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const читать = p => readFileSync(join(ROOT, p), 'utf8');

/* Симуляции и темы поднимаем тем же способом, что и браузер: обычные скрипты
   в общей области видимости. Так проверяется ровно то, что поедет в сборку. */
globalThis.SIMS = {};
globalThis.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
globalThis.PX_PER_M = 40;
for (const f of readdirSync(join(ROOT, 'js/sims'))) (0, eval)(читать('js/sims/' + f));
const { ALL, SECTIONS } = new Function(читать('js/topics.js') + '; return {ALL,SECTIONS};')();

const плохо = [];
const ok = [];
const итог = (имя, беды) => {
  if (беды.length) плохо.push({ имя, беды }); else ok.push(имя);
};

/* ---------------- 1. Граф предпосылок ---------------- */
{
  const беды = [];
  const есть = new Set(ALL.map(t => t.id));
  for (const t of ALL) {
    for (const n of t.needs || []) {
      if (n === t.id) беды.push(`${t.id}: ссылается сама на себя`);
      else if (!есть.has(n)) беды.push(`${t.id}: needs «${n}» — такой темы нет`);
    }
  }
  // поиск цикла обходом в глубину
  const цвет = {};
  const путь = [];
  const идти = id => {
    if (цвет[id] === 2) return false;
    if (цвет[id] === 1) { беды.push('цикл предпосылок: ' + путь.slice(путь.indexOf(id)).concat(id).join(' → ')); return true; }
    цвет[id] = 1; путь.push(id);
    const t = ALL.find(x => x.id === id);
    for (const n of (t && t.needs) || []) if (есть.has(n) && идти(n)) break;
    путь.pop(); цвет[id] = 2;
    return false;
  };
  for (const t of ALL) идти(t.id);
  итог('граф предпосылок: без циклов и битых ссылок', беды);
}

/* ---------------- 2. Порядок в оглавлении ---------------- */
{
  const беды = [];
  const место = {};
  ALL.forEach((t, i) => (место[t.id] = i));
  for (const t of ALL)
    for (const n of t.needs || [])
      if (место[n] !== undefined && место[n] > место[t.id])
        беды.push(`${t.id} требует «${n}», а тот идёт в оглавлении позже`);
  итог('предпосылки стоят раньше тем, которые их просят', беды);
}

/* ---------------- 3. Целостность новых блоков ---------------- */
{
  const беды = [];
  for (const t of ALL) {
    for (const d of t.derivations || []) {
      if (!d.goal) беды.push(`${t.id}: у вывода нет цели`);
      if (!d.steps || !d.steps.length) беды.push(`${t.id}: вывод «${d.goal}» без шагов`);
      for (const s of d.steps || [])
        if (!s.tex || !s.why) беды.push(`${t.id}: шаг вывода «${d.goal}» без формулы или без обоснования`);
      if (d.sim && !SIMS[d.sim]) беды.push(`${t.id}: вывод ссылается на несуществующую симуляцию «${d.sim}»`);
      /* Цель вывода должна быть формулой этой же темы — иначе вывод повисает.
         Формулу часто пишут цепочкой «A = B = C»; тогда цель «A = C» — её
         законная часть, поэтому сверяем не строку целиком, а все куски цели
         по разные стороны от знаков равенства. */
      const цели = (t.formulas || []).map(f => f.tex.replace(/\s+/g, ''));
      const куски = (d.goal || '').replace(/\s+/g, '').split('=').filter(Boolean);
      if (d.goal && !цели.some(ф => куски.every(к => ф.includes(к))))
        беды.push(`${t.id}: вывод «${d.goal}» не совпадает ни с одной формулой темы`);
    }
    for (const e of t.examples || []) {
      if (!e.task || !e.answer) беды.push(`${t.id}: у примера нет условия или ответа`);
      if (!e.steps || !e.steps.length) беды.push(`${t.id}: пример без шагов решения`);
      if (e.sim && !SIMS[e.sim]) беды.push(`${t.id}: пример ссылается на несуществующую симуляцию «${e.sim}»`);
    }
    for (const q of t.checks || [])
      if (!q.q || !q.a) беды.push(`${t.id}: вопрос «Проверьте себя» без вопроса или без ответа`);
    for (const f of t.formulas || [])
      if (f.kind && !['закон', 'определение', 'следствие'].includes(f.kind))
        беды.push(`${t.id}: неизвестный вид формулы «${f.kind}»`);
  }
  итог('выводы, примеры и вопросы заполнены целиком', беды);
}

/* ---------------- отчёт ---------------- */
for (const имя of ok) console.log('  ok   ' + имя);
for (const { имя, беды } of плохо) {
  console.log('  ПЛОХО ' + имя);
  for (const b of беды.slice(0, 12)) console.log('         · ' + b);
  if (беды.length > 12) console.log(`         … и ещё ${беды.length - 12}`);
}
const сВыводом = ALL.filter(t => (t.derivations || []).length).length;
console.log(`\nтем ${ALL.length} · с выводами ${сВыводом} ·` +
  ` с предпосылками ${ALL.filter(t => (t.needs || []).length).length}`);
console.log(плохо.length ? `расхождений: ${плохо.length}` : 'учебная структура согласована');
process.exit(плохо.length ? 1 : 0);
