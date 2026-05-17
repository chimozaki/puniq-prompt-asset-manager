@echo off

:: ======================================================
:: 以下のパスを自分の環境に合わせて書き換えてください
:: Please change the path below to match your environment
:: 例 / Example: C:\Users\YourName\Documents\puniq-prompt-asset-manager
:: ======================================================
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager

start http://localhost:5173/

npm run dev

pause
