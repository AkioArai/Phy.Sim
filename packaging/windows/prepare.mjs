/* Кладёт содержимое пособия рядом с оболочкой Electron.

   Берём защищённую сборку dist/ (обфусцированную), а не исходники: .exe
   попадает к ученикам ровно так же, как dist/, и ответы к задачам не должны
   читаться в «Просмотре кода». Иконку тоже готовим здесь, чтобы
   electron-builder не искал её вручную. */
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('Нет dist/index.html. Сначала выполните в корне проекта:  npm run build');
  process.exit(1);
}

const appDir = join(here, 'app');
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
cpSync(dist, appDir, { recursive: true });

mkdirSync(join(here, 'build'), { recursive: true });
cpSync(join(root, 'packaging', 'icon-512.png'), join(here, 'build', 'icon.png'));

console.log('Готово: packaging/windows/app/ — содержимое пособия, build/icon.png — иконка.');
