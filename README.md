# 🎨 PuniQ Prompt Asset Manager

![PuniQ Prompt Asset Manager](screenshot_exsample.png)

---

## [☕ Support on Ko-fi](https://ko-fi.com/puniq)

**[日本語](#日本語) | [English](#english) | [繁體中文](#繁體中文) | [Español](#español)**

---

<a name="日本語"></a>

# 🇯🇵 日本語

## これは何？

**PuniQ Prompt Asset Manager** は、Stable Diffusion などのAI画像生成ツールで使う「プロンプト（呪文）」をローカルで管理できるアプリです。

> 💡 **プロンプトとは？** AIに絵を描いてもらうときに入力するテキストのことです。「anime girl, white dress, flower field」のような文章で、AIへの指示書のようなものです。

ブラウザ上で動くので、インストールは最小限。データはすべて **自分のパソコンの中だけに保存**されます。外部サーバーには何も送信しません。

---

## 主な機能

- ✅ プロンプトの保存・編集・削除
- 🖼 サムネイル画像の登録
- 🏷 タグで分類
- ❤️ お気に入り管理
- 🔍 フリーワード検索
- 📤 CSV形式でエクスポート（バックアップ）
- 📥 CSVまたはZIPからインポート（復元）

---

## 必要なもの

- **Node.jsのLTS版**
  1. まず `start_puniq_pam.bat` をダブルクリックし、アプリが開けば導入済みです。
  2. 「Node.js is not installed...」と表示された場合は、[Node.js公式ダウンロードページ](https://nodejs.org/en/download)を開きます。
  3. **LTS（長期サポート版）**のWindows用インストーラー（`.msi`）をダウンロードします。「Current」ではなく「LTS」を選んでください。
  4. `.msi`を実行し、基本的に `Next` → 利用規約に同意 → `Next` → `Install` → `Finish` と初期設定のまま進めます。
  5. Windowsを再起動し、もう一度BATを実行します。

確認したい場合は、スタートメニューで「コマンドプロンプト」を開き、`node -v`を入力します。`v24...`のように`v`から始まる番号が表示されれば準備完了です。番号は例と違っていても問題ありません。

---

## 起動方法

### Windowsの場合

#### ステップ1：ファイルをダウンロードする

このページの右上にある緑色の「**Code**」ボタンをクリック →「**Download ZIP**」を選んでダウンロードします。

ダウンロードしたZIPを**好きな場所に解凍**してください。
例：`C:\Users\あなたの名前\Documents\puniq-prompt-asset-manager`

---

#### ステップ2：アプリを起動する

`start_puniq_pam.bat` を**ダブルクリック**するとブラウザが自動で開きます。

初回は必要なnpmファイルをBATが自動で導入するため、インターネット接続が必要です。手動で`npm install`を実行する必要はありません。

> [!IMPORTANT]
> 通常は必ず `start_puniq_pam.bat` から起動し、自動で開く `http://localhost:5173/` を使用してください。`127.0.0.1`や別のポートで開くと、ブラウザ内に残っている旧データは別扱いになります。

- 起動中は、タスクバーに最小化されている「Puniq Prompt Asset Manager」のサーバー画面を閉じないでください。
- 2回目以降もBATをダブルクリックするだけです。
- BATは自分のフォルダを自動認識するため、パスの書き換えは不要です。

#### 以前のブラウザからデータを移す

ローカル保存ファイルがまだ空の場合、現在開いているブラウザの旧データを自動で`data`フォルダへ移します。

1. `start_puniq_pam.bat`を起動したままにします。
2. **以前データを入力していたブラウザ**を開きます。
3. アドレス欄へ `http://localhost:5173/` と入力して開きます。
4. 旧データが表示されると、プロンプトと画像がローカル保存へ自動移行されます。

先に新しいブラウザが開いても、実データが見つからない間は初期サンプルをローカル保存として確定しません。画面に「⚠ 旧ブラウザから移行できます」と出ている間に、旧ブラウザで上記URLを開いてください。

---

### Mac / Linuxの場合

ターミナルを開いて以下を順番に実行：

```bash
# フォルダに移動
cd puniq-prompt-asset-manager

# 必要なファイルをインストール（初回のみ）
npm install

# アプリを起動
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

---

## 使い方

### プロンプトを保存する

1. 上部の「プロンプト記入エリア」でタイトル・プロンプトを入力
2. サムネイル画像を選ぶ（任意）
3. タグをつける（任意）
4. 「保存」ボタンをクリック

### バックアップ（エクスポート）

- 右上の「📤 Export」ボタンをクリック
- **Chrome** → 保存先フォルダを選ぶと、タイムスタンプ付きのフォルダにCSVと画像がまとめて書き出されます
- **Brave・その他ブラウザ** → `タイムスタンプ_export.zip` として自動ダウンロードされます（ZIP内の構造は同じ）

### 復元（インポート）

- 「📥 Import」ボタンからCSVまたはZIPファイルを選ぶと読み込まれます
- ZIPを選ぶとサムネイル画像も一緒に復元されます

---

## データはどこに保存される？

| データ | 主な保存場所 |
| ------ | ------------ |
| プロンプト・タグ・お気に入り・表示設定 | `data/prompt-assets.json` |
| ひとつ前のプロンプトデータ | `data/prompt-assets.previous.json` |
| サムネイル画像 | `data/images/` |
| 補助キャッシュ | 現在のブラウザのlocalStorage / IndexedDB |

BAT起動時はブラウザを変更しても同じ`data`フォルダを読み込みます。ブラウザキャッシュを消しても主データは残りますが、アプリのフォルダ自体を削除すると`data`も消えるため、定期的に「📤 Export」でZIPバックアップを取ってください。

> [!WARNING]
> GitHubから新しい版をダウンロードしてフォルダごと交換する場合は、先に古い版の`data`フォルダを安全な場所へコピーしてください。

---

## ☕ Support

このプロジェクトが役に立った場合は、Ko-fiで今後の開発を応援していただけると嬉しいです。

☕ https://ko-fi.com/puniq

ご支援ありがとうございます！

---

## ライセンス

MIT License © 2026 PuniQ

---

<a name="english"></a>

# 🇺🇸 English

## What is this?

**PuniQ Prompt Asset Manager** is a local prompt management app for AI image generation tools like Stable Diffusion.

> 💡 **What's a prompt?** It's the text you type to tell an AI what to draw — something like `anime girl, white dress, flower field`. Think of it as a recipe for the AI.

It runs in your browser and stores everything **locally on your own PC**. Nothing is sent to any external server.

---

## Features

- ✅ Save, edit, and delete prompts
- 🖼 Attach thumbnail images
- 🏷 Organize with tags
- ❤️ Mark favorites
- 🔍 Free-word search
- 📤 Export to CSV (backup)
- 📥 Import from CSV or ZIP (restore)

---

## Requirements

- **Node.js LTS**
  1. First, double-click `start_puniq_pam.bat`. If the app opens, Node.js is already installed.
  2. If it says “Node.js is not installed...”, open the [official Node.js download page](https://nodejs.org/en/download).
  3. Download the Windows installer (`.msi`) for the **LTS** release, not “Current.”
  4. Run the installer with its default options, then restart Windows.

To verify it, open Command Prompt and enter `node -v`. A number beginning with `v` means it is ready.

---

## How to Run

### Windows

#### Step 1: Download the files

Click the green **Code** button at the top right of this page → Select **Download ZIP** and download it.

**Extract the ZIP** to wherever you like.
Example: `C:\Users\YourName\Documents\puniq-prompt-asset-manager`

---

#### Step 2: Launch the app

**Double-click** `start_puniq_pam.bat` — your browser will open automatically.

On the first launch, the BAT automatically installs the required npm dependencies, so an internet connection is required. You do not need to run `npm install` manually.

> [!IMPORTANT]
> Always launch with `start_puniq_pam.bat` and use `http://localhost:5173/`. Keep the minimized server window open while using the app.

#### Migrate data from a previous browser

When local file storage is still empty, the app automatically migrates data from the browser currently showing the old prompts. Keep the BAT running, open the browser you used previously, and visit `http://localhost:5173/`. The initial sample is not committed while the “⚠ You can migrate from your old browser” notice is shown.

---

### Mac / Linux

Open a terminal and run the following:

```bash
# Navigate to the folder
cd puniq-prompt-asset-manager

# Install dependencies (first time only)
npm install

# Start the app
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## How to Use

### Saving a Prompt

1. Fill in the title and prompt text in the form at the top
2. Optionally attach a thumbnail image
3. Optionally add tags
4. Click the **Save** button

### Backup (Export)

- Click the **📤 Export** button
- **Chrome** → Choose a folder — a timestamped folder will be created with your CSV and images inside
- **Brave & other browsers** → A `timestamp_export.zip` file will be downloaded automatically (same folder structure inside)

### Restore (Import)

- Click **📥 Import** and select a CSV or ZIP file to restore your prompts
- Selecting a ZIP file will also restore thumbnail images

---

## Where is my data stored?

| Data | Primary storage |
| ---- | --------------- |
| Prompts, tags, favorites, and display settings | `data/prompt-assets.json` |
| Previous prompt data | `data/prompt-assets.previous.json` |
| Thumbnail images | `data/images/` |
| Secondary cache | Current browser localStorage / IndexedDB |

Browsers share the same `data` folder when launched through the BAT. Export ZIP backups regularly, and copy the `data` folder before replacing the whole app folder with a newer release.

---

## ☕ Support

If you find this project useful and would like to support future development, you can support me on Ko-fi.

☕ https://ko-fi.com/puniq

Thank you for your support!

---

## License

MIT License © 2026 PuniQ

---

<a name="繁體中文"></a>

# 🇹🇼 繁體中文

## 這是什麼？

**PuniQ Prompt Asset Manager** 是一款在本機管理 AI 圖像生成工具（如 Stable Diffusion）所用「提示詞（Prompt）」的應用程式。

> 💡 **什麼是提示詞？** 就是你輸入給 AI 的文字指令，例如 `anime girl, white dress, flower field`。可以把它想成給 AI 的繪圖說明書。

這款應用程式在瀏覽器中運行，所有資料都**只儲存在您自己的電腦裡**，不會傳送到任何外部伺服器。

---

## 主要功能

- ✅ 儲存、編輯、刪除提示詞
- 🖼 附加縮圖圖片
- 🏷 用標籤分類整理
- ❤️ 加入最愛
- 🔍 關鍵字搜尋
- 📤 匯出為 CSV（備份）
- 📥 從 CSV 或 ZIP 匯入（還原）

---

## 必要條件

- **Node.js LTS版**
  1. 先雙擊 `start_puniq_pam.bat`。若應用程式正常開啟，表示已安裝Node.js。
  2. 若顯示「Node.js is not installed...」，請開啟[Node.js官方下載頁面](https://nodejs.org/en/download)。
  3. 下載 **LTS** 的Windows安裝程式（`.msi`），不要選擇「Current」。
  4. 使用預設選項完成安裝，然後重新啟動Windows。

可在命令提示字元輸入 `node -v`；若顯示以`v`開頭的版本號，即表示準備完成。

---

## 啟動方式

### Windows

#### 步驟 1：下載檔案

點擊本頁右上角的綠色「**Code**」按鈕 →「**Download ZIP**」下載。

將 ZIP 解壓縮到您喜歡的位置。
例如：`C:\Users\您的名稱\Documents\puniq-prompt-asset-manager`

---

#### 步驟 2：啟動應用程式

雙擊 `start_puniq_pam.bat`，瀏覽器會自動開啟。

首次啟動時，BAT會自動安裝必要的npm套件，因此需要網路連線，不必手動執行 `npm install`。

> [!IMPORTANT]
> 請固定透過 `start_puniq_pam.bat` 啟動，並使用 `http://localhost:5173/`。使用期間請勿關閉最小化的伺服器視窗。

#### 從舊瀏覽器移轉資料

本機儲存尚未建立時，請保持BAT執行，使用以前輸入資料的瀏覽器開啟 `http://localhost:5173/`。舊提示詞與圖片會自動移轉；顯示「⚠ 可從舊瀏覽器移轉」期間，初始範例不會被確定為主資料。

---

### Mac / Linux

開啟終端機，依序執行以下指令：

```bash
# 移動到資料夾
cd puniq-prompt-asset-manager

# 安裝所需套件（僅第一次需要）
npm install

# 啟動應用程式
npm run dev
```

接著在瀏覽器開啟 `http://localhost:5173`。

---

## 使用方式

### 儲存提示詞

1. 在上方的輸入區填寫標題與提示詞
2. 可選擇附加縮圖圖片
3. 可選擇新增標籤
4. 點擊「保存」按鈕

### 備份（匯出）

- 點擊右上角的「📤 Export」按鈕
- **Chrome** → 選擇目標資料夾，系統會自動建立含時間戳記的資料夾，並將 CSV 與圖片一起輸出
- **Brave 及其他瀏覽器** → 會自動下載 `時間戳記_export.zip` 檔案（ZIP 內結構相同）

### 還原（匯入）

- 點擊「📥 Import」按鈕，選擇 CSV 或 ZIP 檔案即可匯入
- 選擇 ZIP 檔案時，縮圖圖片也會一併還原

---

## 資料儲存在哪裡？

| 資料 | 主要儲存位置 |
| ---- | ------------ |
| 提示詞、標籤、最愛與顯示設定 | `data/prompt-assets.json` |
| 上一份提示詞資料 | `data/prompt-assets.previous.json` |
| 縮圖圖片 | `data/images/` |
| 輔助快取 | 目前瀏覽器的localStorage / IndexedDB |

透過BAT啟動時，不同瀏覽器會共用同一個`data`資料夾。請定期匯出ZIP備份；若要更換整個應用程式資料夾，請先複製舊版的`data`資料夾。

---

## ☕ Support

如果這個專案對您有幫助，歡迎透過 Ko-fi 支持後續開發。

☕ https://ko-fi.com/puniq

感謝您的支持！

---

## 授權條款

MIT License © 2026 PuniQ

---

<a name="español"></a>

# 🇪🇸 Español

## ¿Qué es esto?

**PuniQ Prompt Asset Manager** es una aplicación local para gestionar los "prompts" (instrucciones de texto) que se usan en herramientas de generación de imágenes con IA como Stable Diffusion.

> 💡 **¿Qué es un prompt?** Es el texto que le escribes a la IA para decirle qué dibujar, por ejemplo: `anime girl, white dress, flower field`. Es como una receta de cocina, pero para la inteligencia artificial.

La aplicación funciona en tu navegador y guarda todo **únicamente en tu propio ordenador**. No se envía ningún dato a servidores externos.

---

## Funciones principales

- ✅ Guardar, editar y eliminar prompts
- 🖼 Adjuntar imágenes en miniatura
- 🏷 Organizar con etiquetas
- ❤️ Marcar favoritos
- 🔍 Búsqueda por palabras clave
- 📤 Exportar a CSV (copia de seguridad)
- 📥 Importar desde CSV o ZIP (restaurar)

---

## Requisitos

- **Node.js LTS**
  1. Primero, haz doble clic en `start_puniq_pam.bat`. Si se abre la aplicación, Node.js ya está instalado.
  2. Si aparece “Node.js is not installed...”, abre la [página oficial de descarga de Node.js](https://nodejs.org/en/download).
  3. Descarga el instalador de Windows (`.msi`) de la versión **LTS**, no “Current”.
  4. Instálalo con las opciones predeterminadas y reinicia Windows.

Para comprobarlo, abre el Símbolo del sistema y escribe `node -v`. Un número que empieza por `v` indica que está listo.

---

## Cómo ejecutarlo

### Windows

#### Paso 1: Descargar los archivos

Haz clic en el botón verde **Code** en la parte superior derecha de esta página → Selecciona **Download ZIP** y descárgalo.

**Extrae el ZIP** donde quieras.
Ejemplo: `C:\Users\TuNombre\Documents\puniq-prompt-asset-manager`

---

#### Paso 2: Iniciar la aplicación

Haz doble clic en `start_puniq_pam.bat` y el navegador se abrirá automáticamente.

En el primer inicio, el BAT instala automáticamente las dependencias npm necesarias, por lo que se requiere conexión a Internet. No necesitas ejecutar `npm install` manualmente.

> [!IMPORTANT]
> Inicia siempre con `start_puniq_pam.bat` y usa `http://localhost:5173/`. Mantén abierta la ventana minimizada del servidor mientras uses la aplicación.

#### Migrar datos desde el navegador anterior

Si el almacenamiento local aún está vacío, mantén el BAT en ejecución, abre el navegador que usabas antes y visita `http://localhost:5173/`. Los prompts y las imágenes anteriores se migrarán automáticamente; la muestra inicial no se guardará como dato principal mientras aparezca el aviso de migración.

---

### Mac / Linux

Abre una terminal y ejecuta los siguientes comandos en orden:

```bash
# Entrar a la carpeta
cd puniq-prompt-asset-manager

# Instalar dependencias (solo la primera vez)
npm install

# Iniciar la aplicación
npm run dev
```

Luego abre `http://localhost:5173` en tu navegador.

---

## Cómo usarlo

### Guardar un prompt

1. Rellena el título y el texto del prompt en el formulario de la parte superior
2. Opcionalmente, adjunta una imagen en miniatura
3. Opcionalmente, añade etiquetas
4. Haz clic en el botón **Guardar**

### Copia de seguridad (Exportar)

- Haz clic en el botón **📤 Export**
- **Chrome** → Elige una carpeta — se creará automáticamente una carpeta con marca de tiempo que contiene el CSV y las imágenes
- **Brave y otros navegadores** → Se descargará automáticamente un archivo `marca_de_tiempo_export.zip` (con la misma estructura interna)

### Restaurar (Importar)

- Haz clic en **📥 Import** y selecciona un archivo CSV o ZIP para recuperar tus prompts
- Si seleccionas un ZIP, las imágenes en miniatura también se restaurarán

---

## ¿Dónde se guardan los datos?

| Datos | Almacenamiento principal |
| ----- | ------------------------ |
| Prompts, etiquetas, favoritos y configuración | `data/prompt-assets.json` |
| Datos anteriores | `data/prompt-assets.previous.json` |
| Imágenes en miniatura | `data/images/` |
| Caché secundaria | localStorage / IndexedDB del navegador actual |

Los navegadores comparten la misma carpeta `data` al iniciar mediante el BAT. Exporta copias ZIP con regularidad y copia la carpeta `data` antes de sustituir toda la carpeta de la aplicación.

---

## ☕ Support

Si este proyecto te resulta útil y deseas apoyar su desarrollo futuro, puedes apoyarme en Ko-fi.

☕ https://ko-fi.com/puniq

¡Muchas gracias por tu apoyo!

---

## Licencia

MIT License © 2026 PuniQ
