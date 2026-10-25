@echo off
setlocal
cd /d "%~dp0"
title PixelPath

where npm >nul 2>nul
if errorlevel 1 goto :missing

if not exist "node_modules\electron\dist\electron.exe" call npm install
if errorlevel 1 goto :failed

call npm run electron:dev
if errorlevel 1 goto :failed
goto :done

:missing
echo Node.js ve npm bulunamadi. https://nodejs.org adresinden Node.js LTS kurun.
goto :failed

:failed
echo.
echo PixelPath baslatilamadi. Yukaridaki hata mesajini kontrol et.
pause

:done
