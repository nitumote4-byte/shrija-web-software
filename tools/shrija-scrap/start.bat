@echo off
setlocal EnableExtensions
title Shrija Scrap Tool v2.0
cd /d "%~dp0"

echo.
echo  Shrija Scrap Tool
echo  -----------------
echo  Folder: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install from https://nodejs.org/ then run start.bat again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node -v') do echo  Node: %%V

REM Use normal user Playwright browser folder (not Cursor sandbox)
set "PLAYWRIGHT_BROWSERS_PATH=%LOCALAPPDATA%\ms-playwright"

REM Free port 19876 if an old scrap tool is still running (safe PID parse)
echo  Checking port 19876...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":19876 .*LISTENING"') do (
  if not "%%P"=="0" if not "%%P"=="" (
    echo  Stopping old process PID %%P
    taskkill /F /PID %%P >nul 2>nul
  )
)

if not exist "node_modules\" (
  echo.
  echo  Installing npm packages first time...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\tsx\" (
  echo [ERROR] tsx missing. Running npm install...
  call npm.cmd install
)

if not exist "%PLAYWRIGHT_BROWSERS_PATH%\chromium-1228\chrome-win64\chrome.exe" (
  echo.
  echo  Chromium missing - downloading once...
  call npx.cmd playwright install chromium
  if errorlevel 1 (
    echo [ERROR] Chromium download failed. Check internet.
    pause
    exit /b 1
  )
)

echo.
echo  Starting on http://127.0.0.1:19876
echo  Keep this window OPEN.
echo  1) Type Manak captcha + Login
echo  2) Click yellow Fetch Received List
echo.

node --import tsx src/index.ts
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo [ERROR] Scrap tool stopped with code %ERR%
  echo If port busy, close other scrap windows and try again.
) else (
  echo Scrap tool exited.
)
echo.
pause
endlocal
