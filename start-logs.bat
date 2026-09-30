@echo off
chcp 65001 >nul 2>&1
setlocal
title HOOHR - Logs
rem ---------------------------------------------------------------------
rem HOOHR log window.
rem
rem Opens its own CMD window, follows both containers live, and appends
rem everything to logs\hoohr.log. Close the window (or press Ctrl+C) to stop
rem watching - the app keeps running.
rem
rem This file MUST stay pure ASCII: cmd.exe tracks its read position in
rem bytes, so a single multi-byte UTF-8 character corrupts every line after
rem it. The Korean text lives in logs.ps1 (UTF-8 with a BOM).
rem ---------------------------------------------------------------------
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~dp0logs.ps1' -ErrorAction SilentlyContinue"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0logs.ps1"
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  pause
)
endlocal & exit /b %RC%
