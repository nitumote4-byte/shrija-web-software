@echo off
cd /d "%~dp0"
echo.
echo  Shrija Gold-Shark-FAST setup
echo  ----------------------------
echo  Step 1: start-chrome-for-manak.bat  (login Manak once)
echo  Step 2: START-HERE.bat              (scrap tool Online)
echo  Step 3: Shrija Auto Request - Fetch Request
echo.
start "" "%~dp0start-chrome-for-manak.bat"
timeout /t 3 /nobreak >nul
cmd /k start.bat
