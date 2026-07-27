@echo off
rem ============================================================
rem  Phy.Sim — сборка .exe для Windows одним двойным кликом.
rem  Нужен только Node.js (https://nodejs.org, версия LTS).
rem  Кладите этот файл там же, где он лежит: packaging\windows\
rem ============================================================
setlocal
cd /d "%~dp0"

echo.
echo [1/3] Собираю содержимое пособия (dist)...
pushd ..\..
call npm install --no-audit --no-fund || goto :err
call npm run build || goto :err
popd

echo.
echo [2/3] Ставлю Electron и electron-builder (первый раз это долго)...
call npm install --no-audit --no-fund || goto :err

echo.
echo [3/3] Собираю .exe...
call npm run dist || goto :err

echo.
echo ГОТОВО. Файлы лежат в папке out:
dir /b out\*.exe
echo.
echo   "Phy.Sim Setup 1.0.0.exe"    — установщик
echo   "Phy.Sim-portable-1.0.0.exe" — запускается без установки
pause
exit /b 0

:err
echo.
echo ОШИБКА. Проверьте, что установлен Node.js и есть интернет.
pause
exit /b 1
