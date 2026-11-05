@echo off
setlocal
if not defined APPDATA (
  echo Windows could not locate your AppData folder.
  pause
  exit /b 1
)
if not exist "%APPDATA%\TaleForge" (
  echo No campaign-data folder exists yet. Start TaleForge and create a campaign first.
  pause
  exit /b 0
)
explorer.exe "%APPDATA%\TaleForge"
