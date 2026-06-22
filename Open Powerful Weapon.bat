@echo off
REM Double-click this file to launch Powerful Weapon (development mode).
REM A black command window will open and stay open while the app runs.
REM Close the command window to stop the app.

cd /d "%~dp0"

REM First-time setup: install dependencies
if not exist "node_modules" (
    echo.
    echo First-time setup: installing dependencies. This takes a few minutes.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo Install failed. Press any key to close.
        pause >nul
        exit /b 1
    )
)

echo.
echo Starting Powerful Weapon...
echo (Close this window to stop the app.)
echo.

call npm run dev
pause
