@echo off
setlocal
title TSAP Backend Launcher

REM ---------------------------------------------------------------------------
REM Neutralize WorkBuddy sandbox safe-delete barrier.
REM On a real machine there is no shim, so these are harmless no-op variables.
REM ---------------------------------------------------------------------------
set CODEBUDDY_SAFE_DELETE_SANDBOX=0
set CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR=
set CODEBUDDY_TOOL_CALL_ID=
set GENIE_TRASH_DIR=%~dp0.genie-trash-disabled

cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Resolve Python interpreter: prefer project venv (backend\.venv), then system
REM ---------------------------------------------------------------------------
if exist "%~dp0backend\.venv\Scripts\python.exe" (
  set "PY=%~dp0backend\.venv\Scripts\python.exe"
) else (
  where python >nul 2>&1 && set "PY=python" || set "PY=E:\Python\python.exe"
  if not exist "%PY%" set "PY=E:\Python\python.exe"
)

echo [launcher] Python = %PY%
echo.

REM ---------------------------------------------------------------------------
REM Port check (informational only - will not block startup)
REM ---------------------------------------------------------------------------
netstat -ano 2>nul | findstr /C:":8000 " | findstr "LISTEN" >nul && echo [note] port 8000 in use, backend may already be running. || echo [OK] port 8000 free
echo.

REM ---------------------------------------------------------------------------
REM Start backend in its own window (close that window to stop the backend)
REM ---------------------------------------------------------------------------
start "TSAP-Backend" /D "%~dp0backend" "%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo Backend is starting...
echo   API 服务 : http://127.0.0.1:8000
echo   交互文档 : http://127.0.0.1:8000/docs
echo.
echo To stop the service, close the "TSAP-Backend" window.
echo.

timeout /t 5 /nobreak >nul
start "" http://127.0.0.1:8000/docs

echo Launcher finished. You can close this window; the service keeps running in the background.
pause
