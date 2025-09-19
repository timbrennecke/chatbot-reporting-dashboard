@echo off
setlocal enabledelayedexpansion

rem Chatbot Reporting Dashboard - Windows Auto Deploy Script
rem This script automatically fetches the latest version from GitHub and sets up the application locally

rem Configuration
set "REPO_URL=https://github.com/timbrennecke/chatbot-reporting-dashboard.git"
set "APP_NAME=chatbot-reporting-dashboard"
set "INSTALL_DIR=%USERPROFILE%\Desktop\%APP_NAME%"
set "NODE_MIN_VERSION=18"

rem Colors (limited in batch)
set "COLOR_RESET="
set "COLOR_BLUE=[94m"
set "COLOR_GREEN=[92m"
set "COLOR_YELLOW=[93m"
set "COLOR_RED=[91m"

echo.
echo %COLOR_BLUE%╔══════════════════════════════════════════════╗%COLOR_RESET%
echo %COLOR_BLUE%║        Chatbot Reporting Dashboard          ║%COLOR_RESET%
echo %COLOR_BLUE%║           Auto Deploy Script                ║%COLOR_RESET%
echo %COLOR_BLUE%╚══════════════════════════════════════════════╝%COLOR_RESET%
echo.

rem Function to print status messages
goto :main

:print_status
echo %COLOR_BLUE%[INFO]%COLOR_RESET% %~1
goto :eof

:print_success
echo %COLOR_GREEN%[SUCCESS]%COLOR_RESET% %~1
goto :eof

:print_warning
echo %COLOR_YELLOW%[WARNING]%COLOR_RESET% %~1
goto :eof

:print_error
echo %COLOR_RED%[ERROR]%COLOR_RESET% %~1
goto :eof

:command_exists
where %1 >nul 2>nul
goto :eof

:check_node_version
for /f "tokens=1 delims=v." %%i in ('node --version 2^>nul') do (
    set "NODE_VERSION=%%i"
    set "NODE_VERSION=!NODE_VERSION:v=!"
)
if !NODE_VERSION! geq %NODE_MIN_VERSION% (
    exit /b 0
) else (
    exit /b 1
)

:check_prerequisites
call :print_status "Checking prerequisites..."

rem Check Git
call :command_exists git
if errorlevel 1 (
    call :print_error "Git is required but not installed."
    echo.
    echo Please install Git from: https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)

rem Check Node.js
call :command_exists node
if errorlevel 1 (
    call :print_error "Node.js is required but not installed."
    goto :install_node_help
)

call :check_node_version
if errorlevel 1 (
    call :print_error "Node.js v%NODE_MIN_VERSION%+ is required. Current version: !NODE_VERSION!"
    goto :install_node_help
)

rem Check npm
call :command_exists npm
if errorlevel 1 (
    call :print_error "npm is required but not found. Please install Node.js with npm."
    pause
    exit /b 1
)

call :print_success "All prerequisites are met!"
goto :eof

:install_node_help
echo.
echo Please install Node.js from one of these sources:
echo 1. Official website: https://nodejs.org/
echo 2. Using Chocolatey: choco install nodejs
echo 3. Using Scoop: scoop install nodejs
echo 4. Using winget: winget install OpenJS.NodeJS
echo.
pause
exit /b 1

:cleanup_existing
if exist "%INSTALL_DIR%" (
    call :print_warning "Existing installation found at %INSTALL_DIR%"
    set /p "REPLY=Do you want to remove it and install fresh? (y/N): "
    if /i "!REPLY!"=="y" (
        call :print_status "Removing existing installation..."
        rmdir /s /q "%INSTALL_DIR%" 2>nul
        call :print_success "Existing installation removed."
        exit /b 0
    ) else (
        call :print_status "Updating existing installation..."
        cd /d "%INSTALL_DIR%"
        git fetch origin
        if errorlevel 1 (
            call :print_error "Failed to update existing installation. Will do fresh install."
            cd /d "%~dp0"
            rmdir /s /q "%INSTALL_DIR%" 2>nul
            exit /b 0
        )
        git reset --hard origin/main
        if errorlevel 1 (
            call :print_error "Failed to update existing installation. Will do fresh install."
            cd /d "%~dp0"
            rmdir /s /q "%INSTALL_DIR%" 2>nul
            exit /b 0
        )
        exit /b 1
    )
)
exit /b 0

:clone_repository
call :print_status "Cloning repository from GitHub..."

rem Create parent directory if it doesn't exist
if not exist "%USERPROFILE%\Desktop" mkdir "%USERPROFILE%\Desktop"

git clone "%REPO_URL%" "%INSTALL_DIR%"
if errorlevel 1 (
    call :print_error "Failed to clone repository."
    pause
    exit /b 1
)

cd /d "%INSTALL_DIR%"
call :print_success "Repository cloned successfully!"
goto :eof

:install_dependencies
call :print_status "Installing dependencies..."
npm install
if errorlevel 1 (
    call :print_error "Failed to install dependencies."
    pause
    exit /b 1
)
call :print_success "Dependencies installed successfully!"
goto :eof

:start_application
call :print_status "Starting the application..."
echo.
call :print_success "🎉 Chatbot Reporting Dashboard is ready!"
echo.
echo %COLOR_BLUE%Next steps:%COLOR_RESET%
echo • The application will start automatically in your browser
echo • If it doesn't open, visit: http://localhost:3000
echo • To stop the application, press Ctrl+C
echo.
echo %COLOR_YELLOW%To run the application again later:%COLOR_RESET%
echo cd "%INSTALL_DIR%" ^&^& npm run dev
echo.

rem Start the development server
npm run dev
goto :eof

:main
call :check_prerequisites
if errorlevel 1 exit /b 1

rem Check if we're updating existing installation
call :cleanup_existing
set "UPDATE_RESULT=!errorlevel!"

if !UPDATE_RESULT! equ 0 (
    call :clone_repository
    if errorlevel 1 exit /b 1
)

call :install_dependencies
if errorlevel 1 exit /b 1

call :start_application

echo.
pause
