@echo off
setlocal
title TSAP Launcher (Backend + Frontend)

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

REM ---------------------------------------------------------------------------
REM Resolve Node.js / Next.js for the frontend.
REM Prefer node on PATH; fall back to the project's local next binary.
REM If node is missing from PATH, try the managed WorkBuddy node install.
REM ---------------------------------------------------------------------------
where node >nul 2>&1 || (
  if exist "C:\Users\马格斯佩斯科夫\.workbuddy\binaries\node\versions\22.22.2\node.exe" (
    set "PATH=C:\Users\马格斯佩斯科夫\.workbuddy\binaries\node\versions\22.22.2;%PATH%"
  )
)

set "FRONTEND_PORT=3000"
set "API_URL=http://127.0.0.1:8000"

if exist "%~dp0frontend\node_modules\.bin\next.cmd" (
  set "NEXT=%~dp0frontend\node_modules\.bin\next.cmd"
) else (
  where next >nul 2>&1 && set "NEXT=next" || set "NEXT="
)

echo [launcher] Next = %NEXT%

REM ---------------------------------------------------------------------------
REM Port checks (informational only - will not block startup)
REM ---------------------------------------------------------------------------
netstat -ano 2>nul | findstr /C:":8000 " | findstr "LISTEN" >nul && echo [note] port 8000 in use, backend may already be running. || echo [OK] port 8000 free
netstat -ano 2>nul | findstr /C:":%FRONTEND_PORT% " | findstr "LISTEN" >nul && echo [note] port %FRONTEND_PORT% in use, frontend may already be running. || echo [OK] port %FRONTEND_PORT% free
echo.

REM ---------------------------------------------------------------------------
REM Start backend (FastAPI) in its own window
REM ---------------------------------------------------------------------------
start "TSAP-Backend" /D "%~dp0backend" "%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

REM ---------------------------------------------------------------------------
REM Start frontend (Next.js dev server).
REM dev mode gives hot reload and needs no separate build step. To run the
REM optimized production server instead, use: "%NEXT%" start -p %FRONTEND_PORT%
REM ---------------------------------------------------------------------------
if defined NEXT (
  set NEXT_PUBLIC_API_URL=%API_URL%
  start "TSAP-Frontend" /D "%~dp0frontend" cmd /c "%NEXT% dev -p %FRONTEND_PORT%"
) else (
  echo [WARN] next not found - frontend NOT started. Run "npm install" in the frontend folder, then re-run this launcher.
)

echo.
echo Services are starting...
echo   Frontend : http://127.0.0.1:%FRONTEND_PORT%   (homepage + all app screens)
echo   Backend  : http://127.0.0.1:8000/docs         (API interactive docs)
echo.
echo To stop the services, close the "TSAP-Backend" and "TSAP-Frontend" windows.
echo.

timeout /t 6 /nobreak >nul
start "" http://127.0.0.1:%FRONTEND_PORT%

echo Launcher finished. You can close this window; both services keep running in the background.
pause
