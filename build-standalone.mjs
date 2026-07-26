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

/* Список файлов берём ПРЯМО из index.html и в том же порядке. Раньше он был
   выписан здесь руками, и новый файл симуляций попадал в обычную версию, но
   не в сборку — расхождение обнаруживалось только по числу симуляций. */
function jsFilesFromHtml(html){
  const out=[]; const re=/<script[^>]*\ssrc="((?:js\/)[^"]+)"/gi; let m;
  while((m=re.exec(html))) out.push(m[1]);
  if(!out.length) throw new Error('в index.html не найдено ни одного <script src="js/...">');
  return out;
}
const JS_FILES = jsFilesFromHtml(read('index.html'));
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
