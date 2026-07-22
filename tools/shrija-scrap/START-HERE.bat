@echo off
REM Double-click helper: keeps window open even if start.bat fails early
cd /d "%~dp0"
cmd /k start.bat
