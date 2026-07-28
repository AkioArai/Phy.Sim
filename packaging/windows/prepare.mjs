/* Кладёт содержимое пособия рядом с оболочкой Electron.

   Копируем исходники как есть: приложение открытое, прятать нечего.
   Иконку готовим здесь же, чтобы electron-builder не искал её вручную. */
import { mkdirSync, rmSync, cpSync } from 'node:fs';
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

console.log('Готово: packaging/windows/app/ — содержимое пособия, build/icon.png — иконка.');
