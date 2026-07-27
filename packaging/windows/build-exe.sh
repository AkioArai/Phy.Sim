#!/usr/bin/env bash
# ============================================================
#  Phy.Sim — сборка .exe для Windows на Linux (Fedora, Ubuntu).
#  Запуск:  bash packaging/windows/build-exe.sh
#
#  Нужны node/npm и Wine, причём 32-битный тоже: rcedit (иконка и
#  свойства файла) и установщик NSIS — 32-битные программы.
# ============================================================
set -e
cd "$(dirname "$0")"

if ! command -v wine >/dev/null; then
  echo "Нет wine. Установите:"
  echo "  Fedora: sudo dnf install wine wine.i686"
  echo "  Ubuntu: sudo dpkg --add-architecture i386 && sudo apt update \\"
  echo "          && sudo apt install wine64 libgd3:i386 wine32:i386"
  exit 1
fi

# Отдельный 32-битный префикс. С 64-битным сборка падает на
# «'/root/.wine' is a 64-bit installation, it cannot be used with
# a 32-bit wineserver» — 32-битные rcedit и NSIS в нём не запускаются.
export WINEPREFIX="${WINEPREFIX:-$HOME/.wine32-physim}"
export WINEARCH=win32
export WINEDEBUG=-all
[ -d "$WINEPREFIX" ] || wineboot -u >/dev/null 2>&1

echo "[1/3] Собираю содержимое пособия (dist)…"
( cd ../.. && npm install --no-audit --no-fund && npm run build )

echo "[2/3] Ставлю Electron и electron-builder (первый раз это долго)…"
npm install --no-audit --no-fund

echo "[3/3] Собираю .exe…"
npm run dist

echo
echo "ГОТОВО:"
ls -la out/*.exe
