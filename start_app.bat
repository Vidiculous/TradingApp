@echo off
echo ===========================================
echo   Starting MarketDASH PRO Trading App
echo ===========================================

:: Get the directory of this script to ensure we run from project root
cd /d "%~dp0"

echo [1/3] Starting Backend Server (Port 8000)...
start "TradingApp Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

echo [2/3] Starting Frontend Server (Port 3001)...
start "TradingApp Frontend" cmd /k "cd frontend && npm run dev"

echo [3/3] Opening Dashboard in Browser...
timeout /t 5 >nul
start http://localhost:3001

echo.
echo ===========================================
echo   System is running!
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:3001
echo ===========================================
echo.
pause
