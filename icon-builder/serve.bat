@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8000
echo [1] dir: %cd%

set PY=
where python >nul 2>nul
if %errorlevel% equ 0 set PY=python
if defined PY goto havepy
where py >nul 2>nul
if %errorlevel% equ 0 set PY=py
:havepy

echo [2] python="%PY%"
if not defined PY goto nopy

%PY% --version
echo.
echo ===============================================
echo  HHG Icon Builder - local server
echo  http://localhost:%PORT%/arc-circle-frame.html
echo  stop: close window or Ctrl+C
echo ===============================================
start "" http://localhost:%PORT%/arc-circle-frame.html
%PY% -m http.server %PORT%
echo.
echo [server stopped] exit code %errorlevel%
pause
goto end

:nopy
echo [ERROR] Python not found. install python or add to PATH.
pause

:end