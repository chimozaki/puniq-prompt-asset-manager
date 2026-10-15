@echo off
setlocal
cd /d "%~dp0"
title Prompt Asset Manager

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

curl.exe -q --noproxy "*" --silent --output nul --connect-timeout 1 --max-time 2 http://localhost:4177/api/local-storage/health
if not errorlevel 1 (
  echo Port 4177 is already in use. Close the existing local server before starting this copy.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Restoring npm dependencies...
  call npm install --prefer-offline --no-audit --no-fund
  if errorlevel 1 (
    echo Failed to install npm dependencies.
    pause
    exit /b 1
  )
)

set "PUNIQ_PAM_LAUNCH_ID=%RANDOM%-%RANDOM%-%RANDOM%-%RANDOM%-%RANDOM%"
start "Prompt Asset Manager - Local Server" /min cmd /k "title Prompt Asset Manager - Local Server && cd /d ""%~dp0"" && node node_modules\vite\bin\vite.js --host localhost --port 4177 --strictPort"

for /l %%I in (1,1,30) do (
  curl.exe -q --noproxy "*" --silent --fail --connect-timeout 1 --max-time 2 http://localhost:4177/api/local-storage/health | findstr /L /C:"%PUNIQ_PAM_LAUNCH_ID%" >nul 2>&1
  if not errorlevel 1 goto open_app
  timeout /t 1 /nobreak >nul
)

echo The app server did not start within 30 seconds.
echo Check the "Prompt Asset Manager - Local Server" window for details.
pause
exit /b 1

:open_app
start "" http://localhost:4177/
exit /b 0
