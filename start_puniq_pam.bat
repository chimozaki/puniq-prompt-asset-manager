@echo off

:: ======================================================
:: 以下のパスを自分の環境に合わせて書き換えてください
:: Please change the path below to match your environment
:: 例 / Example: C:\Users\YourName\Documents\puniq-prompt-asset-manager
:: ======================================================
cd /d "%~dp0"

start cmd /c "npm run dev"
timeout /t 1 /nobreak > nul
start http://localhost:5173/