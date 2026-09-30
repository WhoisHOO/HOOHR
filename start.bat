@echo off
chcp 65001 >nul 2>&1
setlocal
title HOOHR - Start
rem ---------------------------------------------------------------------
rem HOOHR launcher.
rem
rem This file MUST stay pure ASCII. cmd.exe tracks its read position in
rem bytes, so a single multi-byte UTF-8 character shifts every following
rem line - in testing one Korean word here corrupted "%~dp0" on a later
rem line into a bogus command. All Korean text lives in start.ps1, which is
rem saved as UTF-8 with a BOM and is read correctly by PowerShell.
rem ---------------------------------------------------------------------
cd /d "%~dp0"

rem A .ps1 that arrived inside a downloaded zip can carry Mark-of-the-Web and
rem be refused before it runs. Clearing it costs nothing when absent.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~dp0start.ps1' -ErrorAction SilentlyContinue"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo   FAILED - see the message above.
  echo   For details, run start-logs.bat in a second window.
  echo.
  pause
)
endlocal & exit /b %RC%
