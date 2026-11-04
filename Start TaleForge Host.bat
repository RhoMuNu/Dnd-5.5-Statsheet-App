@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

node -e "if (Number(process.versions.node.split('.')[0]) < 18) process.exit(1)"
if errorlevel 1 goto old_node

if not exist "node_modules\vite\bin\vite.js" (
  echo First-time setup: downloading TaleForge's app files...
  call npm install
  if errorlevel 1 goto setup_failed
)

set TALEFORGE_OPEN_BROWSER=1
echo Starting TaleForge. Keep this window open while your group is playing.
echo The app will open on this PC when the host is ready.
echo Press Ctrl+C in this window to stop the host.
call npm run host
if errorlevel 1 echo TaleForge stopped or reported an error. The message above can help diagnose it.
pause
exit /b

:missing_node
echo One-time setup needed: install Node.js LTS, then double-click this file again.
echo Download it from https://nodejs.org/en/download
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:old_node
echo TaleForge needs Node.js 18 or newer. Please install the current Node.js LTS version.
echo Download it from https://nodejs.org/en/download
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:setup_failed
echo First-time setup could not download the app dependencies. Check your internet connection and try again.
pause
exit /b 1
