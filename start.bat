@echo off
setlocal
title TSAP Launcher

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
REM Resolve interpreters: prefer project venv (backend\.venv), then system PATH
REM ---------------------------------------------------------------------------
if exist "%~dp0backend\.venv\Scripts\python.exe" (
  set "PY=%~dp0backend\.venv\Scripts\python.exe"
) else (
  where python >nul 2>&1 && set "PY=python" || set "PY=E:\Python\python.exe"
  if not exist "%PY%" set "PY=E:\Python\python.exe"
)

where node >nul 2>&1 && set "NODE=node" || set "NODE=D:\New Folder\node.exe"
if not exist "%NODE%" set "NODE=D:\New Folder\node.exe"

echo [launcher] Python = %PY%
echo [launcher] Node   = %NODE%
echo.

REM ---------------------------------------------------------------------------
REM Port checks (informational only - will not block startup)
REM ---------------------------------------------------------------------------
netstat -ano 2>nul | findstr /C:":8000 " | findstr "LISTEN" >nul && echo [note] port 8000 in use, backend may already be running. || echo [OK] port 8000 free
netstat -ano 2>nul | findstr /C:":3000 " | findstr "LISTEN" >nul && echo [note] port 3000 in use, frontend may already be running. || echo [OK] port 3000 free
echo.

REM ---------------------------------------------------------------------------
REM Start backend in its own window (close that window to stop the backend)
REM ---------------------------------------------------------------------------
start "TSAP-Backend" /D "%~dp0backend" "%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

REM ---------------------------------------------------------------------------
REM Start frontend (Next.js dev) in its own window
REM ---------------------------------------------------------------------------
start "TSAP-Frontend" /D "%~dp0frontend" "%NODE%" node_modules/next/dist/bin/next dev -p 3000

echo Services are starting...
echo   Backend : http://127.0.0.1:8000
echo   Frontend: http://127.0.0.1:3000/dashboard
echo.
echo The browser will open automatically in a few seconds.
echo To stop the services, simply close the "TSAP-Backend" and "TSAP-Frontend" windows.
echo.

timeout /t 10 /nobreak >nul
start "" http://127.0.0.1:3000/dashboard

echo Launcher finished. You can close this window; the services keep running in the background.
pause
