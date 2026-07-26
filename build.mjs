/* =============================================================================
   Phy.Sim — сборка защищённой версии.

   Собирает из читаемых исходников (css/, js/) один самодостаточный файл
   dist/index.html, в котором:
     • все скрипты склеены в один блок и обфусцированы
       (переименование имён, шифрование строк, самозащита от переформатирования);
     • стили минифицированы и встроены;
     • KaTeX по-прежнему подгружается с CDN (это внешняя библиотека).

   ВАЖНО про «шифрование»: код в браузере невозможно защитить по-настоящему —
   он обязан выполняться на устройстве, поэтому его всегда можно восстановить.
   Обфускация лишь поднимает планку: превращает исходник в нечитаемую кашу,
   которую обычный школьник не разберёт (в том числе ответы к задачам).

   Разработка ведётся в читаемых js/ и css/. Ученикам отдаётся dist/index.html.
   Запуск сборки:  node build.mjs   (или npm run build)
   ============================================================================= */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import JavaScriptObfuscator from 'javascript-obfuscator';
import CleanCSS from 'clean-css';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

/* Порядок обязан совпадать с порядком <script> в index.html: классические
   скрипты делят одну глобальную область, и склейка в этом же порядке
   эквивалентна их последовательной загрузке. */
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

const bundle = JS_FILES.map((f) => read(f)).join('\n;\n');

/* Настройки подобраны под приложение с 240-кадровым физическим циклом и
   отрисовкой на canvas: намеренно НЕ включаем control-flow-flattening и
   dead-code-injection — они сильнее всего бьют по производительности.

   Также ВЫКЛЮЧЕНЫ selfDefending и disableConsoleOutput: на таком объёме кода
   их «самозащитные» инъекции периодически вставляют строку-детектор с
   непечатаемым разделителем и делают бандл синтаксически невалидным. Оставляем
   только механические, надёжные преобразования — они и дают нечитаемость:
   переименование имён и шифрование/дробление строк. */
const OBF_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  simplify: true,
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: true,          // безопасно: инлайновых onclick-обработчиков в HTML нет
  selfDefending: false,
  disableConsoleOutput: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 1,       // шифруем ВСЕ строки — открытым текстом ничего не остаётся
  stringArrayCallsTransform: true,
  splitStrings: true,           // дробим строки на куски — сложнее выцепить текст
  splitStringsChunkLength: 8,
  transformObjectKeys: false,   // симуляции адресуются как SIMS[id] по строковым ключам — не трогаем
  unicodeEscapeSequence: false,
  target: 'browser',
};

/* Обфускация недетерминирована. Даже с надёжными настройками редкий прогон
   может выдать невалидный код, поэтому проверяем результат парсером и при
   ошибке перевыпускаем с другим seed. Битый артефакт уехать не может. */
function obfuscateValid(src) {
  for (let seed = 1; seed <= 12; seed++) {
    const code = JavaScriptObfuscator.obfuscate(src, { ...OBF_OPTIONS, seed }).getObfuscatedCode();
    // компиляция как СКРИПТА (как в браузере, не как тела функции) без исполнения — ловит SyntaxError
    try { new vm.Script(code); return { code, seed }; }
    catch (e) { console.warn(`  seed ${seed}: невалидно (${e.message}), пробую следующий`); }
  }
  throw new Error('Не удалось получить валидный обфусцированный бандл за 12 попыток');
}
const { code: obfuscated, seed: usedSeed } = obfuscateValid(bundle);

const css = new CleanCSS({ level: 2 }).minify(read('css/style.css')).styles;

/* Берём исходный index.html как шаблон:
   • стили встраиваем инлайном (<link> → <style>);
   • обфусцированный бандл кладём ОТДЕЛЬНЫМ файлом app.min.js, а не инлайном.
     Инлайн опасен: если внутри строки кода окажется последовательность,
     закрывающая тег (</script с пробелом/слэшем/переносом), HTML-парсер
     оборвёт скрипт и код сломается. Внешний файл этого класса ошибок лишён
     и защищён ровно так же. */
let html = read('index.html');

/* replace() ВАЖНО: подставляем через функцию, а не строку. У строки-замены
   в String.replace есть спецсимволы ($$, $&, $` и т.п.) — если бы CSS/JS
   содержал их буквально (а KaTeX-делимитер '$$' в коде именно так и
   выглядит), replace() тихо испортил бы вставляемый текст. */
html = html.replace(
  '<link rel="stylesheet" href="css/style.css">',
  () => `<style>${css}</style>`
);

// все локальные подключения скриптов заменяем одним внешним бандлом
html = html.replace(/[\t ]*<script defer src="js\/[^"]+"><\/script>\r?\n?/g, '');
html = html.replace('</head>', () => `<script defer src="app.min.js"></script>\n</head>`);

const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'app.min.js'), obfuscated);
writeFileSync(join(distDir, 'index.html'), html);
// KaTeX копируем как есть: чужую библиотеку обфусцировать незачем,
// а без неё формулы в dist/ показывались бы сырым TeX-ом
cpSync(join(root, 'vendor'), join(distDir, 'vendor'), { recursive: true });

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' КБ';
console.log(`Сборка готова: dist/index.html + dist/app.min.js (seed ${usedSeed})`);
console.log(`  исходный JS:    ${kb(bundle)}`);
console.log(`  обфусц. JS:     ${kb(obfuscated)}`);
console.log(`  итоговый HTML:  ${kb(html)}`);
