@echo off
title WhatsApp Automate - Launcher
cd /d "%~dp0"

echo.
echo  Starting WhatsApp Automate...
echo.

:: 1. WhatsApp Bridge (Node.js)
start "WA Bridge" cmd /k "cd /d "%~dp0whatsapp-bridge" && node index.js"

:: Wait a moment before starting backend
timeout /t 2 /nobreak >nul

:: 2. Backend (FastAPI)
start "WA Backend" cmd /k "cd /d "%~dp0backend" && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 7001 --reload"

:: 3. Frontend (Vite dev server)
start "WA Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  All 3 services started in separate windows:
echo    Bridge   -^>  port 7002
echo    Backend  -^>  http://localhost:7001
echo    Frontend -^>  http://localhost:5173
echo.
echo  Open your browser at: http://localhost:5173
echo.
pause
