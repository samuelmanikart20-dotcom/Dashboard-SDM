@echo off
echo ========================================
echo Running SPMT System
echo ========================================
echo.

echo Cleaning up .next folder...
if exist ".next" (
    echo Removing .next folder...
    rmdir /s /q ".next" 2>nul
    if exist ".next" (
        echo Failed to remove .next folder. Please close any applications using it.
        pause
        exit /b 1
    )
)

echo.
echo Installing dependencies...
call npm install

echo.
echo Starting application on port 3002...
set PORT=3002
call npm run dev

echo.
echo Application stopped.
pause

