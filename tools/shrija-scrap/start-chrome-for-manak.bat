@echo off
setlocal
title Shrija Manak Chrome (debug)
echo.
echo  ========================================
echo   Shrija FAST mode = Chrome + Manak login
echo  ========================================
echo.
echo  1) This opens Chrome with debugging (port 9222)
echo  2) Login to Manak ONCE (captcha only first time)
echo  3) Keep Chrome open
echo  4) Run START-HERE.bat (scrap tool)
echo  5) In Shrija click Fetch Request  (no captcha again)
echo.

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
  echo [ERROR] Google Chrome not found.
  pause
  exit /b 1
)

set "PROFILE=%LOCALAPPDATA%\ShrijaScrapChrome"
if not exist "%PROFILE%" mkdir "%PROFILE%"

echo  Starting Chrome...
start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%PROFILE%" "https://huid.manakonline.in/MANAK/eBISLogin"

echo.
echo  Chrome started. Login to Manak, then start scrap tool.
echo.
pause
endlocal
