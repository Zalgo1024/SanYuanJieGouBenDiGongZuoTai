@echo off
setlocal
title Triad Analysis - Verify (core regression check)
cd /d "%~dp0"

echo ============================================
echo   Triad Analysis System - Verify
echo   Run this after changing code to confirm
echo   core features are not broken.
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify-all.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo [PASS] Core features OK. Safe to deliver.
) else (
  echo [FAIL] Core features affected. Fix before delivering.
)
echo.
pause
exit /b %EXIT_CODE%
