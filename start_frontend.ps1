# AyuMitra AI — Frontend Startup Script

Write-Host "🚀 Starting AyuMitra AI Frontend..." -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm not found. Please install Node.js (https://nodejs.org)." -ForegroundColor Red
    exit 1
}

Set-Location "$PSScriptRoot\frontend"

if (-not (Test-Path ".env")) {
    Write-Host "⚠️  frontend/.env not found — creating from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "📦 Installing dependencies (if needed)..." -ForegroundColor Yellow
npm install --silent

Write-Host ""
Write-Host "🌐 Starting React app on http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

npm start
