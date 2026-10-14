@echo off
chcp 65001 >nul 2>&1
setlocal
title HOOHR - Uninstall
rem ---------------------------------------------------------------------
rem HOOHR uninstaller. Stops the containers and deletes ALL data
rem (database + uploaded receipts). Must stay pure ASCII - see start.bat.
rem Korean text lives in uninstall.ps1 (UTF-8 with BOM).
rem ---------------------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~dp0uninstall.ps1' -ErrorAction SilentlyContinue"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
endlocal
