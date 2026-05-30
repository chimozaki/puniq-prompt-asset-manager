@echo off
setlocal

REM Step 2: Edit the part after "cd /d" on the next line to your extracted folder path.
REM Example: C:\Users\YourName\Documents\puniq-prompt-asset-manager
REM 手順2: 次の行の「cd /d」以降の部分を、ZIPを解凍したあなたのフォルダパスに書き換えてください。
REM 例: C:\Users\YourName\Documents\puniq-prompt-asset-manager
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager

REM 移動先に package.json があるか確認（パス書き換えミス対策）
if not exist "package.json" (
  echo [ERROR] package.json was not found in the target folder.
  echo [ERROR] 指定フォルダに package.json がありません。
  echo [ERROR] Please check the path in start_puniq_pam.bat.
  echo [ERROR] start_puniq_pam.bat のパス設定を確認してください。
  pause
  exit /b 1
)

REM npm (Node.js) が使えるか確認
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js LTS.
  echo [ERROR] npm が見つかりません。Node.js（LTS版）をインストールしてください。
  pause
  exit /b 1
)

REM 依存パッケージ未インストール時のみ自動インストール
if not exist "node_modules\" (
  echo [INFO] Installing dependencies...
  echo [INFO] 依存パッケージをインストールしています...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    echo [ERROR] 依存パッケージのインストールに失敗しました。
    pause
    exit /b 1
  )
)

REM 開発サーバーを新しいコマンド画面で起動
start "PuniQ PAM Dev Server" cmd /k "npm run dev"
REM 少し待ってからブラウザを開く
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173/"
exit /b 0
