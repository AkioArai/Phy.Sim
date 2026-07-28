/* =============================================================================
   Phy.Sim — сборка .apk без Android Studio и без Android SDK.

   Обычный путь (Gradle + SDK) требует несколько гигабайт и аккаунт Google.
   Здесь всё нужное берётся тремя файлами с Maven Central и кладётся в
   packaging/android/.tools (в git не попадает):

     • aapt2                — упаковщик ресурсов, лежит внутри apktool-lib;
     • dalvik-dx            — переводит .class в classes.dex;
     • android-all          — android.jar для компиляции (org.robolectric);
     • android-framework.jar— ресурсы системы для aapt2, тоже из apktool-lib.

   Подпись ставится jarsigner из JDK (схема v1). Этого достаточно, потому что
   манифест объявляет targetSdkVersion=29: требование «только v2 и выше»
   Android предъявляет к приложениям с targetSdk 30+.

   Запуск:  npm run build:apk
   Итог:    packaging/android/out/phy-sim.apk
   ============================================================================= */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync, chmodSync, cpSync,
         openSync, readSync, closeSync } from 'node:fs';
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

const APP = {
  pkg: 'ru.physim.app',
  versionCode: '1',
  versionName: '1.0',
  minSdk: '21',
  targetSdk: '29',
};

const run = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
  } catch (e) {
    // без этого Node печатает сообщение инструмента байтовым массивом
    const err = (e.stderr || e.stdout || '').toString().trim();
    throw new Error(`${cmd} завершился с ошибкой:\n${err}`);
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

/* ---------- 5. Сборка и подпись ---------- */
function keystore() {
  const ks = join(here, 'phy-sim.keystore');   // в .gitignore: приватный ключ не коммитим
  if (!existsSync(ks)) {
    step('создаю ключ подписи (phy-sim.keystore, пароль physim)');
    run('keytool', ['-genkeypair', '-keystore', ks, '-storepass', 'physim', '-keypass', 'physim',
      '-alias', 'physim', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10950',
      '-dname', 'CN=Phy.Sim, OU=Physics, O=Phy.Sim, C=RU']);
    console.log('  ВАЖНО: сохраните этот файл. Обновление приложения «поверх»');
    console.log('  возможно только с тем же ключом, иначе придётся удалять старую версию.');
  }
  return ks;
}

function assemble(baseApk, dex) {
  mkdirSync(out, { recursive: true });
  const apk = join(out, 'phy-sim.apk');
  rmSync(apk, { force: true });
  run('cp', [baseApk, apk]);
  step('добавляю classes.dex');
  run('zip', ['-q', '-X', '-j', apk, dex]);
  step('подпись (jarsigner, схема v1)');
  run('jarsigner', ['-keystore', keystore(), '-storepass', 'physim', '-keypass', 'physim',
    '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', apk, 'physim']);
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
