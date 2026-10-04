@echo off
setlocal EnableDelayedExpansion
TITLE Crisis Command - Local ^& Cloudflare Launcher
COLOR 0A

echo ============================================================
echo   CRISIS COMMAND - MULTI-AGENT EMERGENCY RESPONSE SYSTEM
echo   Local Deployment with Cloudflare Tunnel (Windows)
echo ============================================================
echo.

:: 1. PREREQUISITE CHECKS
echo [Step 1/5] Checking environment requirements...

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on your system PATH!
    echo Please install Node.js (v18+) from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found on your system PATH!
    echo Please install Node.js and npm from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found on your system PATH!
    echo Please install Python (3.10+) from: https://www.python.org/
    echo.
    pause
    exit /b 1
)

:: Check Cloudflare Tunnel CLI (cloudflared)
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ============================================================
    echo [ERROR] Cloudflare Tunnel CLI (cloudflared) is NOT installed!
    echo ============================================================
    echo Cloudflare Tunnel is required to expose the frontend safely.
    echo.
    echo To install cloudflared on Windows:
    echo   1. Using Windows Package Manager (recommended):
    echo      winget install Cloudflare.cloudflared
    echo.
    echo   2. Or download the standalone executable:
    echo      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    echo      Rename it to cloudflared.exe and add it to your PATH
    echo      (e.g., C:\Program Files\cloudflared\)
    echo.
    echo After installing, restart this terminal and run start-cloudflare.bat again.
    echo ============================================================
    echo.
    pause
    exit /b 1
)

echo [OK] All prerequisites found: node, npm, python, cloudflared.
echo.

set "ROOT_DIR=%~dp0"

:: 2. START BACKEND
echo [Step 2/5] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Crisis Command - Backend" cmd /k "cd /d "%ROOT_DIR%backend" && if exist venv\Scripts\activate.bat (call venv\Scripts\activate) && uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Wait for backend to be healthy
python "%ROOT_DIR%scripts\tunnel_launcher.py" check-backend
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend failed to start. Aborting Cloudflare Tunnel launch.
    pause
    exit /b 1
)
echo.

:: 3. START FRONTEND
echo [Step 3/5] Starting React + Vite Frontend on http://127.0.0.1:5173 ...
start "Crisis Command - Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev -- --host 0.0.0.0"

:: Wait for frontend to be healthy
python "%ROOT_DIR%scripts\tunnel_launcher.py" check-frontend
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend failed to start. Aborting Cloudflare Tunnel launch.
    pause
    exit /b 1
)
echo.

:: 4. OPEN LOCAL BROWSER ONCE
echo [Step 4/5] Opening local interface in default browser...
python "%ROOT_DIR%scripts\tunnel_launcher.py" open-browser
echo.

:: 5. START CLOUDFLARE TUNNEL AND DISPLAY URL
echo [Step 5/5] Establishing Cloudflare Tunnel to expose frontend...
python "%ROOT_DIR%scripts\tunnel_launcher.py" start-tunnel

pause
