@echo off
chcp 65001 >nul 2>&1
setlocal
title HOOHR - Public Tunnel
rem ---------------------------------------------------------------------
rem Opens the app to the internet through a Cloudflare Tunnel, so other
rem people can use it instead of just this machine.
rem
rem Close the tunnel with:  docker rm -f hoohr_tunnel
rem Closing THIS window does not close the tunnel.
rem
rem This file MUST stay pure ASCII: cmd.exe tracks its read position in
rem bytes, so a single multi-byte UTF-8 character corrupts every line after
rem it. The Korean text lives in start-tunnel.ps1 (UTF-8 with a BOM).
rem ---------------------------------------------------------------------
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~dp0start-tunnel.ps1' -ErrorAction SilentlyContinue"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-tunnel.ps1"
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo   FAILED - see the message above.
  echo   For details, run start-logs.bat in a second window.
  echo.
  pause
)
endlocal & exit /b %RC%
