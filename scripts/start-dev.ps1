#!/usr/bin/env pwsh
# ============================================================
# WhatsApp Automate - Start Development Environment
# Usage: .\scripts\start-dev.ps1
# ============================================================

Write-Host "Starting WhatsApp Automate Development Environment" -ForegroundColor Green

# --- Check Prerequisites ---
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Install Python 3.10+" -ForegroundColor Red
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install Node.js 18+" -ForegroundColor Red
    exit 1
}

Write-Host "Prerequisites OK" -ForegroundColor Green

# --- Backend ---
Write-Host ""
Write-Host "Starting Backend (FastAPI on :8000)..." -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "..\backend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000"
) -WindowStyle Normal

Start-Sleep -Seconds 3

# --- WhatsApp Web Bridge ---
Write-Host "Starting WhatsApp Web JS Bridge (Node.js on :3000)..." -ForegroundColor Cyan

$bridgePath = Join-Path $PSScriptRoot "..\whatsapp-bridge"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$bridgePath'; node index.js"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# --- Frontend ---
Write-Host "Starting Frontend (React Vite on :5173)..." -ForegroundColor Cyan

$frontendPath = Join-Path $PSScriptRoot "..\frontend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendPath'; npm run dev"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Yellow
Write-Host "   Frontend:   http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:    http://localhost:8000" -ForegroundColor White
Write-Host "   WA Bridge:  http://localhost:3000/status" -ForegroundColor White
Write-Host "   API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "   Health:     http://localhost:8000/health" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop..." -ForegroundColor Gray
