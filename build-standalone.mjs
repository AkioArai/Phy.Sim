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
/* ---------------- Проверка учебного контента перед сборкой ----------------
   Символ «<» внутри формулы браузер принимает за начало тега и проглатывает
   ближайший закрывающий тег — из-за этого половина главы однажды уехала
   внутрь <div class="callout"> и стала серой. Ошибка не видна ни в syntax
   check, ни в тестах физики, поэтому проверяем её здесь и роняем сборку. */
function checkContentEscaping(topicsSrc){
  const TAGS='div|p|ul|ol|li|strong|em|h2|h3|span|br|sup|sub|code|kbd|b|i|article|table|tr|td|th';
  const bad=new RegExp('<(?!\\/?(?:'+TAGS+')[\\s>/])','g');
  const hits=[];
  // все $...$ в topics.js — формулы KaTeX
  const re=/\$([^$\n]*)\$/g; let m;
  while((m=re.exec(topicsSrc))){
    if(m[1].includes('<'))
      hits.push('неэкранированный «<» в формуле: ' + m[0].slice(0,60));
  }
  if(hits.length){
    console.error('\nСБОРКА ОСТАНОВЛЕНА — в учебном контенте есть «<», ломающий разметку:');
    hits.slice(0,10).forEach(h=>console.error('  • '+h));
    if(hits.length>10) console.error('  … и ещё '+(hits.length-10));
    console.error('Замените «<» на «&lt;» — KaTeX получит его обратно как «<».\n');
    process.exit(1);
  }
  void bad;
}

const JS_FILES = jsFilesFromHtml(read('index.html'));
checkContentEscaping(read('js/topics.js'));
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
