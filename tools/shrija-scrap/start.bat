@echo off
title Shrija Scrap Tool
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install from https://nodejs.org/ then run start.bat again.
  pause
  exit /b 1
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
echo Starting Shrija Scrap Tool on http://127.0.0.1:19876
echo Keep this window open while using Auto Request.
echo.
call npm start
pause
