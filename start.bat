@echo off
echo ========================================
echo   SixthField FieldNotes - Development
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting SixthField FieldNotes development server...
echo.
echo The application will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm run dev