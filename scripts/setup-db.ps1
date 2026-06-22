#!/usr/bin/env pwsh
# ============================================================
# WhatsApp Automate — Database Setup Script
# Usage: .\scripts\setup-db.ps1 -DbUser root -Password yourpw
# ============================================================

param(
    [string]$DbUser = "root",
    [string]$Password = "",
    [string]$DbHost = "localhost",
    [string]$Database = "whatsapp_automate"
)

Write-Host "Setting up WhatsApp Automate Database" -ForegroundColor Green

$schemaPath = Join-Path $PSScriptRoot "..\database\schema.sql"
$seedPath   = Join-Path $PSScriptRoot "..\database\seed.sql"

# ─── Locate mysql.exe ────────────────────────────────────────
$mysqlExe = $null
$searchPaths = @(
    "mysql",  # Already in PATH
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysql.exe",
    "C:\xampp\mysql\bin\mysql.exe",
    "C:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe"
)

foreach ($path in $searchPaths) {
    if ($path -eq "mysql") {
        if (Get-Command mysql -ErrorAction SilentlyContinue) {
            $mysqlExe = "mysql"
            break
        }
    } elseif (Test-Path $path) {
        $mysqlExe = $path
        break
    }
}

if (-not $mysqlExe) {
    Write-Host "ERROR: MySQL client not found." -ForegroundColor Red
    Write-Host "Tried: C:\Program Files\MySQL\MySQL Server 8.x\bin\mysql.exe" -ForegroundColor Yellow
    Write-Host "Add MySQL bin folder to your system PATH and retry." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found MySQL at: $mysqlExe" -ForegroundColor Gray

# ─── Build args ──────────────────────────────────────────────
$args = @("-u", $DbUser, "-h", $DbHost)
if ($Password) { $args += @("-p$Password") }

# ─── Run Schema ──────────────────────────────────────────────
Write-Host "Running schema..." -ForegroundColor Cyan

$result = & $mysqlExe @args 2>&1 "--execute=source $schemaPath"
# Use stdin pipe for reliability
Get-Content $schemaPath | & $mysqlExe @args
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "Schema applied successfully" -ForegroundColor Green

    $seed = Read-Host "Load seed data? (y/N)"
    if ($seed -eq 'y' -or $seed -eq 'Y') {
        Get-Content $seedPath | & $mysqlExe @args $Database
        Write-Host "Seed data loaded" -ForegroundColor Green
    }
} else {
    Write-Host "Schema failed (exit code: $exitCode)" -ForegroundColor Red
    Write-Host "Check: password, host, and that MySQL is running" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "   Database : $Database"
Write-Host "   Host     : $DbHost"
Write-Host "   User     : $DbUser"
