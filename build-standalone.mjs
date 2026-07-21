/* Однофайловая читаемая сборка для личного тестирования на телефоне/офлайн.
   В отличие от build.mjs (защищённая dist/ для раздачи ученикам), здесь
   код НЕ обфусцируется — только склеивается в один самодостаточный HTML,
   чтобы избежать проблем с относительными путями (file://, CORS) в
   мобильных браузерах при пересылке через Telegram/почту/облако. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

const JS_FILES = [
  'js/core.js', 'js/sims/mechanics.js', 'js/sims/oscillations.js', 'js/sims/thermo.js',
  'js/sims/electricity.js', 'js/sims/magnetism.js', 'js/sims/waves-optics.js',
  'js/sims/quantum.js', 'js/sims/matter-nuclear.js', 'js/topics.js', 'js/app.js',
];
const bundle = JS_FILES.map((f) => read(f)).join('\n;\n').replace(/<\/script>/gi, '<\\/script>');
const css = read('css/style.css');

let html = read('index.html');
/* replace() ВАЖНО: заменяем через функцию, а не строку — у строки-замены
   в String.replace есть спецсимволы ($$, $&, $` и т.п.), а бандл содержит
   буквальные '$$' (KaTeX-делимитер формул); строкой-заменой это бы обрезало. */
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>${css}</style>`);
html = html.replace(/[\t ]*<script defer src="js\/[^"]+"><\/script>\r?\n?/g, '');
/* ВАЖНО: атрибут defer у ИНЛАЙН-скрипта (без src) браузер игнорирует —
   такой script выполняется сразу при парсинге. Поставленный в <head>, он
   бы упал на document.querySelector('#scene') === null, потому что body
   ещё не разобран. Поэтому вставляем перед </body>, а не в <head>. */
html = html.replace('</body>', () => `<script>${bundle}</script>\n</body>`);

writeFileSync(join(root, 'phy-sim-standalone.html'), html);
console.log('Готово: phy-sim-standalone.html', (Buffer.byteLength(html) / 1024 | 0) + ' КБ');
