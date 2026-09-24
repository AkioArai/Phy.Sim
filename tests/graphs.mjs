/* Проверка связей «производная — интеграл» между графиками симуляций.
   ====================================================================
   В 1.9.0 у графика может стоять пометка наклон: i — «этот график есть
   производная графика i по времени» (со знаком знак: −1 для ЭДС = −dΦ/dt).
   По ней приложение сверяет наклон касательной с соседним графиком и
   площадь под кривой — с изменением величины. Если пометка неверна,
   ученик увидит «расхождение» там, где физика права, — или, хуже,
   «совпадает» там, где связи нет. Поэтому здесь:

   1. пометки корректны: индекс существует, ряды соответствуют, а единицы
      согласованы по размерности — [график i] / с = [график j];
   2. связь выполняется численно: прогоняем симуляцию шагом DT, пишем
      историю так же, как приложение (каждые 6 шагов), и сравниваем
      центральную разность графика i с графиком j (в СИ, со знаком).
      Допуск 5 %: это средняя ошибка за 4 с, у гладких моделей она
      меньше 1 %, у ЭДС с током через сопротивление — около 4 %.

   Запуск:  npm run graphs   (без браузера)
*/
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const читать = p => readFileSync(join(ROOT, p), 'utf8');
globalThis.document = { querySelector: () => null };
const { SIMS, DT } = new Function(читать('js/core.js') + ';return {SIMS, DT: typeof DT!=="undefined"?DT:1/240};')();
globalThis.SIMS = SIMS;
for (const f of readdirSync(join(ROOT, 'js/sims')).filter(f => f.endsWith('.js')).sort())
  new Function(читать('js/sims/' + f))();
const В = new Function(читать('js/calc.js') + ';return ВЫЧ;')();

const беды = [];
const ok = (имя, усл, инфо) => {
  console.log((усл ? '  ok   ' : '  FAIL ') + имя + (инфо === undefined ? '' : '  ' + JSON.stringify(инфо)));
  if (!усл) беды.push(имя);
};
const ед = u => (u ? В.считать('1 ' + u) : { siv: 1, d: [0, 0, 0, 0, 0, 0] });

const связи = [];
for (const [id, d] of Object.entries(SIMS)) (d.graphs || []).forEach((g, j) => {
  if (g.наклон !== undefined) связи.push({ id, d, j, i: g.наклон, знак: g.знак || 1 });
});
ok(`пометок «наклон» найдено: ${связи.length}`, связи.length >= 14, связи.map(с => с.id + ':' + с.j + '←' + с.i));

/* ---------------- 1. пометки корректны ---------------- */
{
  const плохо = [];
  for (const { id, d, i, j, знак } of связи) {
    const gi = d.graphs[i], gj = d.graphs[j];
    if (!gi || i === j) { плохо.push(`${id}: наклон ${i} — нет такого графика`); continue; }
    if (знак !== 1 && знак !== -1) плохо.push(`${id}: знак ${знак}`);
    const ni = (gi.series || [1]).length, nj = (gj.series || [1]).length;
    if (ni !== nj) плохо.push(`${id}: рядов ${nj} против ${ni}`);
    let ui, uj;
    try { ui = ед(gi.unit); uj = ед(gj.unit); } catch (e) { плохо.push(`${id}: единица не разбирается — ${e.message}`); continue; }
    const нужно = ui.d.slice(); нужно[2] -= 1;                // [i]/с
    if (!В.dРавны(нужно, uj.d)) плохо.push(`${id}: «${gi.unit}»/с ≠ «${gj.unit}»`);
  }
  ok('пометки: график существует, ряды и размерности сходятся', плохо.length === 0, плохо);
}

/* ---------------- 2. связь выполняется численно ---------------- */
{
  const плохо = [], итог = [];
  for (const { id, d, i, j, знак } of связи) {
    const p = {};
    for (const q of d.params || []) if (q.key) p[q.key] = q.default;
    const s = d.init(p), H = [];
    for (let k = 0; k < 4 / DT; k++) {
      d.step(s, DT, p);
      if ((k + 1) % 6 === 0) H.push({ t: s.t, v: d.graphs.map(g => g.get(s, p)) });
      if (s.__stop) break;
    }
    const fi = ед(d.graphs[i].unit).siv, fj = ед(d.graphs[j].unit).siv;
    let ошибка = 0, масштаб = 0, n = 0;
    for (let k = 1; k < H.length - 1; k++) for (const ряд of [0, 1]) {
      const a = H[k - 1].v[i][ряд], b = H[k + 1].v[i][ряд], y = H[k].v[j][ряд];
      if (a == null || b == null || y == null || !isFinite(a + b + y)) continue;
      const наклон = (b - a) / (H[k + 1].t - H[k - 1].t) * fi * знак;
      ошибка += Math.abs(наклон - y * fj); масштаб += Math.abs(y * fj); n++;
    }
    const отн = масштаб > 0 ? ошибка / масштаб : NaN;
    итог.push(`${id}:${j}←${i} ${(отн * 100).toFixed(2)}%`);
    if (!(n >= 50 && отн < 0.05)) плохо.push(`${id}: «${d.graphs[j].label}» ≠ d/dt «${d.graphs[i].label}» — ${n} точек, ошибка ${(отн * 100).toFixed(1)} %`);
  }
  ok('наклон графика i совпадает с графиком j (средняя ошибка < 5 %)', плохо.length === 0, плохо.length ? плохо : итог);
}

console.log(беды.length ? `\nграфики: провалов ${беды.length}` : '\nсвязи графиков сходятся');
process.exit(беды.length ? 1 : 0);
