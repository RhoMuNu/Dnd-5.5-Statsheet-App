@echo off
setlocal
cd /d "%~dp0"
title TaleForge - Campaign Host

if exist "runtime\node.exe" goto portable

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

node -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 goto old_node

if not exist "node_modules\vite\bin\vite.js" (
  echo First-time setup: downloading TaleForge's app files...
  call npm ci
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
echo TaleForge needs Node.js 24 or newer. Please install Node.js 24 LTS or newer.
echo Download it from https://nodejs.org/en/download
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:setup_failed
echo First-time setup could not download the app dependencies. Check your internet connection and try again.
pause
exit /b 1

:portable
echo Starting TaleForge. No install or internet connection is needed.
echo Keep this window open while your group is playing.
"%~dp0runtime\node.exe" "%~dp0server\launch.mjs"
if errorlevel 1 (
  echo.
  echo TaleForge could not start. See the message above or open START HERE.txt.
  pause
  exit /b 1
)
exit /b 0
