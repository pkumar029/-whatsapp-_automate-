#!/usr/bin/env pwsh
# ============================================================
# WhatsApp Automate — Database Setup Script
# Usage: .\scripts\setup-db.ps1 -User root -Password yourpw
# ============================================================

param(
    [string]$User = "root",
    [string]$Password = "",
    [string]$Host = "localhost",
    [string]$Database = "whatsapp_automate"
)

Write-Host "🗄️  Setting up WhatsApp Automate Database" -ForegroundColor Green

$schemaPath = Join-Path $PSScriptRoot "..\database\schema.sql"
$seedPath = Join-Path $PSScriptRoot "..\database\seed.sql"

if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
    Write-Host "❌ MySQL client not found. Install MySQL 8.x" -ForegroundColor Red
    exit 1
}

$mysqlArgs = "-u $User -h $Host"
if ($Password) { $mysqlArgs += " -p$Password" }

Write-Host "📋 Running schema..." -ForegroundColor Cyan
Invoke-Expression "mysql $mysqlArgs < '$schemaPath'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Schema applied" -ForegroundColor Green
    
    $seed = Read-Host "Load seed data? (y/N)"
    if ($seed -eq 'y' -or $seed -eq 'Y') {
        Invoke-Expression "mysql $mysqlArgs $Database < '$seedPath'"
        Write-Host "✅ Seed data loaded" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Schema failed — check MySQL credentials" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "   Database: $Database" -ForegroundColor White
Write-Host "   Host: $Host" -ForegroundColor White
