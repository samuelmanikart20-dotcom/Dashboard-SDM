# Force Clean .next Folder Script
# Run this as Administrator if needed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Force Clean .next Folder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$nextPath = ".next"

# Stop any running Node.js processes
Write-Host "Stopping Node.js processes..." -ForegroundColor Yellow
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "Node.js processes stopped" -ForegroundColor Green
} catch {
    Write-Host "No Node.js processes found or already stopped" -ForegroundColor Blue
}

# Force remove .next folder using different methods
Write-Host "Attempting to remove .next folder..." -ForegroundColor Yellow

if (Test-Path $nextPath) {
    try {
        # Method 1: Standard Remove-Item
        Write-Host "Trying standard removal..." -ForegroundColor Blue
        Remove-Item -Path $nextPath -Recurse -Force -ErrorAction Stop
        Write-Host ".next folder removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Standard removal failed, trying alternative methods..." -ForegroundColor Yellow
        
        try {
            # Method 2: Using cmd commands
            Write-Host "Trying cmd method..." -ForegroundColor Blue
            cmd /c "rmdir /s /q $nextPath" 2>$null
            
            if (-not (Test-Path $nextPath)) {
                Write-Host ".next folder removed using cmd method" -ForegroundColor Green
            } else {
                throw "CMD method also failed"
            }
        } catch {
            Write-Host "All removal methods failed" -ForegroundColor Red
            Write-Host "Please try the following:" -ForegroundColor Yellow
            Write-Host "1. Close all applications (VS Code, browser, etc.)" -ForegroundColor White
            Write-Host "2. Restart your computer" -ForegroundColor White
            Write-Host "3. Run this script as Administrator" -ForegroundColor White
            Write-Host "4. Or manually delete the .next folder from File Explorer" -ForegroundColor White
            exit 1
        }
    }
} else {
    Write-Host ".next folder does not exist" -ForegroundColor Green
}

# Clean npm cache
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
try {
    npm cache clean --force
    Write-Host "NPM cache cleaned" -ForegroundColor Green
} catch {
    Write-Host "Failed to clean NPM cache" -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
try {
    npm install
    Write-Host "Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Start application
Write-Host "Starting application..." -ForegroundColor Yellow
Write-Host "Use: npm run dev" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
