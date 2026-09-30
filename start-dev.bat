@echo off
TITLE Crisis Command - Development Environment Launcher
COLOR 0B

echo ============================================================
echo   CRISIS COMMAND - MULTI-AGENT EMERGENCY RESPONSE SYSTEM
echo   GATEWAYS 2026 - Public Safety & Emergency Response
echo ============================================================
echo.

:: Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.11+.
    pause
    exit /b 1
)

:: Check for Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

:: Set working directory
cd /d "%~dp0"

echo [1/3] Setting up Backend Environment...
if not exist "backend\venv" (
    echo Creating Python virtual environment...
    python -m venv backend\venv
)

if not exist "backend\.env" (
    echo Creating backend\.env from template...
    copy backend\.env.example backend\.env >nul
)

echo [2/3] Setting up Frontend Environment...
if not exist "frontend\.env" (
    echo Creating frontend\.env from template...
    copy frontend\.env.example frontend\.env >nul
)

if not exist "frontend\node_modules" (
    echo Installing frontend packages...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [3/3] Launching Local Development Services...
echo  - Backend API:   http://localhost:8000
echo  - Swagger Docs:  http://localhost:8000/docs
echo  - WebSocket:     ws://localhost:8000/ws
echo  - Frontend Web:  http://localhost:5173
echo.

:: Launch Backend in separate window
start "Crisis Command - Backend API (Port 8000)" cmd /k "cd /d %~dp0backend && .\venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Wait 2 seconds for backend initialization
timeout /t 2 /nobreak >nul

:: Launch Frontend in separate window
start "Crisis Command - Frontend UI (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"

:: Wait 2 seconds and open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo ============================================================
echo   Crisis Command is now RUNNING!
echo   Press any key to close this launcher script (services keep running).
echo ============================================================
pause >nul
