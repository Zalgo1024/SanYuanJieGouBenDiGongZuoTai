@echo off
setlocal
title Triad Analysis Workbench - Stop
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-workbench.ps1" -Action stop
set "EXIT_CODE=%ERRORLEVEL%"

echo.
pause
exit /b %EXIT_CODE%
