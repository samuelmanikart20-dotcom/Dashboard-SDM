# PowerShell Script untuk Menjalankan SPMT System
# Jalankan sebagai Administrator jika ada masalah permission

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running SPMT System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cek apakah running sebagai Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "If you encounter permission issues, restart PowerShell as Administrator" -ForegroundColor Yellow
    Write-Host ""
}

# Clean up .next folder
if (Test-Path ".next") {
    Write-Host "Removing .next folder..." -ForegroundColor Yellow
    try {
        Remove-Item -Recurse -Force ".next" -ErrorAction Stop
        Write-Host "Successfully removed .next folder" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to remove .next folder: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please close any applications that might be using it" -ForegroundColor Yellow
        Write-Host "Or restart PowerShell as Administrator" -ForegroundColor Yellow
        Read-Host "Press Enter to continue anyway..."
    }
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Starting application on port 3002..." -ForegroundColor Green
$env:PORT = "3002"
npm run dev

Write-Host ""
Write-Host "Application stopped." -ForegroundColor Cyan
Read-Host "Press Enter to exit..."

