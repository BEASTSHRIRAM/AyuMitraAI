# AyuMitra AI — Backend Startup Script
# Run this AFTER filling in your API keys in backend/.env

Write-Host "🚀 Starting AyuMitra AI Backend..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found. Please install Python 3.10+ and add it to PATH." -ForegroundColor Red
    exit 1
}

Set-Location "$PSScriptRoot\backend"

# Check if virtual environment exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "🐍 Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
} elseif (Test-Path ".venv\Scripts\Activate.ps1") {
    Write-Host "🐍 Activating virtual environment..." -ForegroundColor Yellow
    & ".venv\Scripts\Activate.ps1"
} else {
    Write-Host "⚠️  No venv found — using system Python" -ForegroundColor Yellow
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ backend/.env not found! Please copy .env.example and fill in your keys." -ForegroundColor Red
    exit 1
}

Write-Host "✅ .env found" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Starting FastAPI on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "📖 API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "🔍 Debug doctors: http://127.0.0.1:8000/api/debug/doctors" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
