/* =============================================================================
   Phy.Sim — сборка .apk без Android Studio и без Android SDK.

   Обычный путь (Gradle + SDK) требует несколько гигабайт и аккаунт Google.
   Здесь всё нужное берётся тремя файлами с Maven Central и кладётся в
   packaging/android/.tools (в git не попадает):

     • aapt2                — упаковщик ресурсов, лежит внутри apktool-lib;
     • dalvik-dx            — переводит .class в classes.dex;
     • android-all          — android.jar для компиляции (org.robolectric);
     • android-framework.jar— ресурсы системы для aapt2, тоже из apktool-lib.

   Выравнивание и подпись — системными zipalign и apksigner:

     apt install apksigner zipalign      (либо Android SDK build-tools)

   Раньше подпись ставил jarsigner из JDK, а он умеет только схему v1 —
   подписи отдельных файлов внутри архива. Для сегодняшнего Android этого
   мало, и именно отсюда росли жалобы «приложение не ставится»:

     • Play Protect показывает «вредоносная программа» тем охотнее, чем
       старее подпись и целевой SDK;
     • установщики Xiaomi, Huawei и Samsung отклоняют пакеты только с v1;
     • с targetSdkVersion 30 и выше Android вообще откажется ставить пакет
       без подписи v2 — из-за этого целевой SDK и застрял на 29, а низкий
       targetSdk сам по себе повод для предупреждения на Android 14+.

   Теперь ставятся v1 + v2 + v3 сразу: v1 нужна Android 5 и 6, v2 — всем
   современным, v3 добавляет поддержку смены ключа. Схемы v2 и v3
   подписывают архив целиком, поэтому перед ними обязателен zipalign:
   resources.arsc должен лежать несжатым и по границе 4 байт.

   Запуск:  npm run build:apk
   Итог:    packaging/android/out/phy-sim.apk
   ============================================================================= */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync, chmodSync, cpSync,
         openSync, readSync, closeSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const tools = join(here, '.tools');
const work  = join(here, '.work');
const out   = join(here, 'out');

const M = 'https://repo1.maven.org/maven2';
const DEPS = [
  { name: 'apktool-lib.jar', url: `${M}/org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar` },
  { name: 'dalvik-dx.jar',   url: `${M}/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar` },
  { name: 'android-all.jar', url: `${M}/org/robolectric/android-all/16-robolectric-13921718/android-all-16-robolectric-13921718.jar` },
];

/* Версия — только из корневого package.json. Раньше она была прописана ещё
   и здесь, и в упаковке для Windows, и три места успели разойтись.
   versionCode Android требует целым и строго возрастающим, поэтому считаем
   его из номера версии: 1.2.3 → 10203. */
const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const [MAJ, MIN, PAT] = VERSION.split('.').map(n => parseInt(n, 10) || 0);

const APP = {
  pkg: 'ru.physim.app',
  versionCode: String(MAJ * 10000 + MIN * 100 + PAT),
  versionName: VERSION,
  minSdk: '21',
  /* 34 — актуальный целевой SDK. Держать его низким больше нельзя: Android 14
     предупреждает о приложениях со старым targetSdk, а магазины и вовсе их не
     принимают. Возможным это стало после перехода на apksigner: подпись v2 —
     ровно то, чего Android требует начиная с targetSdk 30. */
  targetSdk: '34',
};

const run = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
  } catch (e) {
    /* Печатаем ОБА потока и код возврата. Раньше бралось только stderr, и
       когда инструмент ругался в stdout (или молчал), сообщение выходило
       пустым: «jarsigner завершился с ошибкой:» и ничего дальше. */
    const out = [e.stderr, e.stdout].map(x => (x || '').toString().trim()).filter(Boolean).join('\n');
    throw new Error(`${cmd} завершился с ошибкой (код ${e.status ?? '?'})` +
      (out ? `:\n${out}` : ' и ничего не сказал.'));
  }
};
const step = (s) => console.log('• ' + s);

/* ---------- 1. Инструменты ---------- */
/* Скачанное обязательно проверяем: без -f curl молча пишет в файл страницу
   ошибки и выходит с нулём, а дальше javac ругается сорока шестью «cannot
   find symbol» — как будто виноват исходник, а не пустой classpath. Проверка
   магии ZIP («PK») ловит и это, и оборванную закачку. */
function checkJar(f, name) {
  const size = statSync(f).size;
  const head = Buffer.alloc(2);
  const fd = openSync(f, 'r');
  try { readSync(fd, head, 0, 2, 0); } finally { closeSync(fd); }
  if (size < 100 * 1024 || head.toString('latin1') !== 'PK') {
    rmSync(f, { force: true });
    throw new Error(`${name}: скачался не архив (${size} байт). ` +
      'Похоже, зеркало Maven ответило ошибкой — попробуйте ещё раз.');
  }
}

function fetchTools() {
  mkdirSync(tools, { recursive: true });
  for (const d of DEPS) {
    const f = join(tools, d.name);
    if (existsSync(f)) { checkJar(f, d.name); continue; }   // и кэш проверяем тоже
    step(`качаю ${d.name} …`);
    run('curl', ['-fsSL', '--retry', '3', '--retry-all-errors', '-o', f, d.url]);
    checkJar(f, d.name);
  }
  const aapt2 = join(tools, 'aapt2');
  const framework = join(tools, 'android-framework.jar');
  if (!existsSync(aapt2) || !existsSync(framework)) {
    step('распаковываю aapt2 и ресурсы системы из apktool');
    run('unzip', ['-o', '-q', '-j', join(tools, 'apktool-lib.jar'),
      'prebuilt/linux/aapt2', 'prebuilt/android-framework.jar', '-d', tools]);
    chmodSync(aapt2, 0o755);
  }
  return { aapt2, framework, dx: join(tools, 'dalvik-dx.jar'), androidJar: join(tools, 'android-all.jar') };
}

/* ---------- 2. Содержимое приложения ---------- */
function collectAssets() {
  const assets = join(work, 'assets');
  mkdirSync(assets, { recursive: true });
  /* Кладём исходники как есть: приложение открытое, прятать нечего.
     Раньше сюда копировалась обфусцированная сборка dist/. */
  cpSync(join(root, 'index.html'), join(assets, 'index.html'));
  for (const d of ['css', 'js', 'vendor'])
    cpSync(join(root, d), join(assets, d), { recursive: true });
  let n = 0, bytes = 0;
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else { n++; bytes += statSync(p).size; }
    }
  })(assets);
  step(`содержимое: ${n} файлов, ${(bytes / 1024 / 1024).toFixed(1)} МБ`);
  return assets;
}

/* ---------- 3. Ресурсы и манифест ---------- */
function linkResources(t, assets) {
  const flat = join(work, 'res.zip');
  step('aapt2 compile — ресурсы');
  run(t.aapt2, ['compile', '--dir', join(here, 'res'), '-o', flat]);
  const apk = join(work, 'base.apk');
  step('aapt2 link — манифест, ресурсы и содержимое');
  run(t.aapt2, ['link', '-o', apk,
    '-I', t.framework,
    '--manifest', join(here, 'AndroidManifest.xml'),
    '-A', assets,
    '--min-sdk-version', APP.minSdk,
    '--target-sdk-version', APP.targetSdk,
    '--version-code', APP.versionCode,
    '--version-name', APP.versionName,
    '--no-version-vectors',
    flat]);   // позиционный аргумент: -R означал бы «оверлей поверх основных»
  return apk;
}

/* ---------- 4. Java → dex ---------- */
function buildDex(t) {
  const classes = join(work, 'classes');
  mkdirSync(classes, { recursive: true });
  const src = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.java')) src.push(p);
    }
  })(join(here, 'src'));
  step(`javac — ${src.length} файл(ов)`);
  // --release 8: dx понимает байт-код не новее Java 8
  run('javac', ['--release', '8', '-nowarn', '-encoding', 'UTF-8',
    '-classpath', t.androidJar, '-d', classes, ...src], { stdio: ['ignore', 'pipe', 'inherit'] });
  step('dx — classes.dex');
  run('java', ['-cp', t.dx, 'com.android.dx.command.Main',
    '--dex', '--min-sdk-version=' + APP.minSdk,
    '--output=' + join(work, 'classes.dex'), classes]);
  return join(work, 'classes.dex');
}

/* ---------- 5. Сборка и подпись ----------
   Android разрешает установить обновление поверх старой версии, только если
   обе подписаны ОДНИМ ключом. Пока ключ генерировался заново на каждой
   сборке, каждый выпуск требовал удалить приложение — а вместе с ним
   стиралось хранилище и весь прогресс ученика. Поэтому:

     PHYSIM_KEYSTORE_B64  — хранилище ключей в base64 (секрет в CI);
     PHYSIM_KEYSTORE      — путь к файлу, если он уже лежит на машине;
     PHYSIM_KEYSTORE_PASS — пароль, PHYSIM_KEYSTORE_ALIAS — псевдоним.

   Если ничего не задано, ключ по-прежнему создаётся сам и переиспользуется
   при следующих локальных сборках — для проверки на своём телефоне этого
   достаточно, а выпускать так нельзя, о чём скрипт предупреждает. */
const clean = v => (v || '').replace(/\s+/g, '');
const KEY = {
  /* Пробелы и переводы строк срезаем: при вставке в поле секрета в конец
     легко попадает перевод строки, и пароль перестаёт подходить — а
     jarsigner на это отвечает молча, без объяснений. */
  pass: clean(process.env.PHYSIM_KEYSTORE_PASS) || 'physim',
  alias: clean(process.env.PHYSIM_KEYSTORE_ALIAS) || 'physim',
};
/* Проверяем хранилище ДО подписи и объясняем, что именно не так. Иначе
   всё сводится к одной строке «jarsigner завершился с ошибкой», по которой
   не понять, испорчен ли файл, не подходит пароль или нет такого псевдонима. */
function checkKey(ks) {
  const size = existsSync(ks) ? statSync(ks).size : 0;
  if (size < 100)
    throw new Error(`хранилище ключей пустое или обрезано (${size} байт). ` +
      'Похоже, значение PHYSIM_KEYSTORE_B64 скопировано не целиком.');
  try {
    run('keytool', ['-list', '-keystore', ks, '-storepass', KEY.pass]);
  } catch (e) {
    throw new Error('не открывается хранилище ключей: не подходит пароль ' +
      '(PHYSIM_KEYSTORE_PASS) или файл повреждён.\n' + e.message);
  }
  try {
    run('keytool', ['-list', '-keystore', ks, '-storepass', KEY.pass, '-alias', KEY.alias]);
  } catch (_) {
    let есть = '';
    try {
      есть = run('keytool', ['-list', '-keystore', ks, '-storepass', KEY.pass])
        .split('\n').filter(l => l.includes('PrivateKeyEntry'))
        .map(l => l.split(',')[0].trim()).join(', ');
    } catch (_) {}
    throw new Error(`в хранилище нет ключа с псевдонимом «${KEY.alias}» ` +
      `(PHYSIM_KEYSTORE_ALIAS).` + (есть ? ` Есть: ${есть}.` : ''));
  }
  step(`хранилище открыто, псевдоним «${KEY.alias}» на месте`);
}

function keystore() {
  if (process.env.PHYSIM_KEYSTORE_B64) {
    const ks = join(work, 'release.keystore');
    mkdirSync(work, { recursive: true });
    writeFileSync(ks, Buffer.from(clean(process.env.PHYSIM_KEYSTORE_B64), 'base64'));
    step('ключ подписи взят из PHYSIM_KEYSTORE_B64');
    checkKey(ks);
    return ks;
  }
  if (process.env.PHYSIM_KEYSTORE) {
    if (!existsSync(process.env.PHYSIM_KEYSTORE))
      throw new Error(`PHYSIM_KEYSTORE указывает на несуществующий файл: ${process.env.PHYSIM_KEYSTORE}`);
    step('ключ подписи взят из PHYSIM_KEYSTORE');
    checkKey(process.env.PHYSIM_KEYSTORE);
    return process.env.PHYSIM_KEYSTORE;
  }
  const ks = join(here, 'phy-sim.keystore');   // в .gitignore: приватный ключ не коммитим
  if (!existsSync(ks)) {
    step('создаю ключ подписи (phy-sim.keystore, пароль physim)');
    run('keytool', ['-genkeypair', '-keystore', ks, '-storepass', KEY.pass, '-keypass', KEY.pass,
      '-alias', KEY.alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10950',
      '-dname', 'CN=Phy.Sim, OU=Physics, O=Phy.Sim, C=RU']);
  }
  console.log('  ВНИМАНИЕ: подпись локальным ключом. Для выпуска задайте');
  console.log('  PHYSIM_KEYSTORE_B64, иначе обновление «поверх» будет невозможно');
  console.log('  и у пользователей сотрётся прогресс.');
  return ks;
}

/* Ищем инструмент сначала в PATH, потом в build-tools Android SDK: на
   виртуалках GitHub Actions SDK уже стоит, а в PATH его нет. */
function findTool(name) {
  try { return run('which', [name]).trim(); } catch (_) {}
  for (const sdk of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, '/usr/lib/android-sdk']) {
    const bt = sdk && join(sdk, 'build-tools');
    if (!bt || !existsSync(bt)) continue;
    // берём самую свежую версию build-tools
    for (const v of readdirSync(bt).sort().reverse()) {
      const p = join(bt, v, name);
      if (existsSync(p)) return p;
    }
  }
  throw new Error(
    `не найден ${name}. Он нужен, чтобы пакет ставился на современные Android.\n` +
    `  Ubuntu/Debian:  sudo apt install apksigner zipalign\n` +
    `  либо поставьте Android SDK и укажите ANDROID_HOME.`);
}

function assemble(baseApk, dex) {
  mkdirSync(out, { recursive: true });
  const apk = join(out, 'phy-sim.apk');
  const raw = join(work, 'unaligned.apk');
  rmSync(apk, { force: true });
  run('cp', [baseApk, raw]);
  step('добавляю classes.dex');
  run('zip', ['-q', '-X', '-j', raw, dex]);

  /* Выравнивание. Без него resources.arsc лежит по случайному смещению, и
     Android с targetSdkVersion 30+ отказывается ставить пакет. Делать это
     нужно ДО подписи: zipalign двигает данные внутри архива, а подписи v2/v3
     считаются по всему файлу целиком и после сдвига стали бы недействительны.
     Флаг -p кладёт несжатыми ещё и .so — своих у нас нет, но так правильнее. */
  const aligned = join(work, 'aligned.apk');
  step('zipalign — выравнивание по 4 байта');
  run(findTool('zipalign'), ['-f', '-p', '4', raw, aligned]);

  step('подпись apksigner — схемы v1, v2 и v3');
  run(findTool('apksigner'), ['sign',
    '--ks', keystore(),
    '--ks-pass', 'pass:' + KEY.pass,
    '--key-pass', 'pass:' + KEY.pass,
    '--ks-key-alias', KEY.alias,
    '--min-sdk-version', APP.minSdk,
    '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true',
    '--v3-signing-enabled', 'true',
    '--out', apk, aligned]);

  /* Проверяем то, что получилось, а не то, что задумали: подпись легко
     объявить включённой и всё равно получить пакет без неё. */
  step('проверка подписи');
  const v = run(findTool('apksigner'), ['verify', '--verbose', apk]);
  const схемы = ['v1', 'v2', 'v3'].filter(s =>
    new RegExp(`Verified using ${s} scheme[^:]*:\\s*true`).test(v));
  if (схемы.length < 3)
    throw new Error(`подпись неполная, подтвердились только: ${схемы.join(', ') || 'ничего'}`);
  step(`подписи на месте: ${схемы.join(' + ')}`);
  run(findTool('zipalign'), ['-c', '4', apk]);   // упадёт, если выравнивание сбилось
  return apk;
}

/* ---------- поехали ---------- */
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const t = fetchTools();
const assets = collectAssets();
const base = linkResources(t, assets);
const dex = buildDex(t);
const apk = assemble(base, dex);
writeFileSync(join(out, 'README.txt'),
  'phy-sim.apk — установочный файл для Android 5.0 и новее.\n' +
  'Установка: скопировать на телефон, открыть, разрешить установку из этого источника.\n' +
  'Интернет не нужен: все 76 симуляций, конспекты, задачи и формулы внутри.\n');
console.log(`\nГотово: ${relative(root, apk)}  (${(statSync(apk).size / 1024 / 1024).toFixed(1)} МБ)`);
