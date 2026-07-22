@echo off
title Shrija Scrap Tool v1.2
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install from https://nodejs.org/ then run start.bat again.
  pause
  exit /b 1
)

REM Kill any old scrap tool still holding port 19876 (stops aggressive old code)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":19876" ^| findstr "LISTENING"') do (
  echo Stopping old scrap tool PID %%P ...
  taskkill /F /PID %%P >nul 2>nul
)

if not exist "node_modules\" (
  echo Installing packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo Installing Chromium for Manak browser...
  call npx playwright install chromium
)

echo.
echo Starting Shrija Scrap Tool v1.2 on http://127.0.0.1:19876
echo After Manak login: open Receiving tab yourself, then click yellow "Scrape this page".
echo Keep this window open.
echo.
call npm start
pause
