/* Кладёт содержимое пособия рядом с оболочкой Electron.

   Копируем исходники как есть: приложение открытое, прятать нечего.
   Иконку готовим здесь же, чтобы electron-builder не искал её вручную. */
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const appDir = join(here, 'app');
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
cpSync(join(root, 'index.html'), join(appDir, 'index.html'));
for (const d of ['css', 'js', 'vendor'])
  cpSync(join(root, d), join(appDir, d), { recursive: true });

mkdirSync(join(here, 'build'), { recursive: true });
cpSync(join(root, 'packaging', 'icon-512.png'), join(here, 'build', 'icon.png'));

/* Версия — только из корневого package.json. Здесь она раньше жила своей
   жизнью, и номера успели разойтись (1.0.0 против 1.0 в apk). Переписываем
   её на месте перед каждой сборкой: electron-builder читает версию именно
   из этого файла и подставляет её в имена установщиков. */
const rootPkgPath = join(root, 'package.json');
const shellPkgPath = join(here, 'package.json');
const version = JSON.parse(readFileSync(rootPkgPath, 'utf8')).version;
const shellPkg = JSON.parse(readFileSync(shellPkgPath, 'utf8'));
if (shellPkg.version !== version) {
  shellPkg.version = version;
  writeFileSync(shellPkgPath, JSON.stringify(shellPkg, null, 2) + '\n');
  console.log(`Версия оболочки приведена к корневой: ${version}`);
}

console.log(`Готово: packaging/windows/app/ — содержимое пособия, build/icon.png — иконка, версия ${version}.`);
