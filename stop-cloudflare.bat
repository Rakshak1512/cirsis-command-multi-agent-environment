@echo off
TITLE Crisis Command - Stop Services
COLOR 0C

echo ============================================================
echo   STOPPING CRISIS COMMAND SERVICES
echo ============================================================
echo.

echo [*] Stopping Cloudflare Tunnel processes...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo [*] Stopping Uvicorn / Python backend processes on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Stopping Vite / Node frontend processes on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [OK] All Crisis Command services stopped.
echo ============================================================
timeout /t 3 >nul
