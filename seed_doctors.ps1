# AyuMitra AI — Seed Doctors Script
# Run ONCE after setting up backend/.env

Write-Host "🌱 Seeding doctors into MongoDB..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"

if (Test-Path "venv\Scripts\Activate.ps1") {
    & "venv\Scripts\Activate.ps1"
} elseif (Test-Path ".venv\Scripts\Activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
}

if (-not (Test-Path ".env")) {
    Write-Host "❌ backend/.env not found! Fill in MONGO_URL first." -ForegroundColor Red
    exit 1
}

python seed_doctors.py
