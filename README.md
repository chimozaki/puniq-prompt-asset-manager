# 🎨 PuniQ Prompt Asset Manager

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

- **Node.js**（バージョン18以上推奨）
  - 入ってるか確認：コマンドプロンプトで `node -v` と打って、数字が表示されればOK
  - 入っていない場合 → [Node.js公式サイト](https://nodejs.org/) から「LTS版」をダウンロードしてインストール

---

## 起動方法

### Windowsの場合

#### ステップ1：ファイルをダウンロードする

このページの右上にある緑色の「**Code**」ボタンをクリック →「**Download ZIP**」を選んでダウンロードします。

ダウンロードしたZIPを**好きな場所に解凍**してください。
例：`C:\Users\あなたの名前\Documents\puniq-prompt-asset-manager`

---

#### ステップ2：batファイルのパスを書き換える

解凍したフォルダの中に `start_puniq_pam.bat` があります。
このファイルを**右クリック → メモ帳で開く**と、以下のような行があります：

```
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager
```

この部分を**自分が解凍したフォルダのパスに書き換えて**保存してください。

> 💡 **パスの調べ方：** エクスプローラーでフォルダを開き、上部のアドレスバーをクリックするとパスが表示されます。それをコピーして貼り付けてください。

---

#### ステップ3：初回のみ npm install を実行する

コマンドプロンプトを開いて以下を実行してください（初回だけ必要です）：

```bash
cd "C:\自分のパスをここに貼り付け"
npm install
```

> 💡 **コマンドプロンプトの開き方：** スタートメニューで「cmd」と検索して開いてください。

---

#### ステップ4：アプリを起動する

`start_puniq_pam.bat` を**ダブルクリック**するとブラウザが自動で開きます。

> 2回目以降はダブルクリックするだけでOKです！

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

| データ | 保存場所 |
|---|---|
| プロンプトのテキスト | ブラウザのlocalStorage（パソコン内） |
| サムネイル画像 | ブラウザのIndexedDB（パソコン内） |

> ⚠️ ブラウザのキャッシュをすべて削除するとデータが消えます。定期的にエクスポートしてバックアップを取ることをおすすめします。

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

- **Node.js** (version 18 or higher recommended)
  - To check if it's installed: open a terminal and type `node -v`. If you see a version number, you're good.
  - Not installed? → Download the **LTS version** from [nodejs.org](https://nodejs.org/)

---

## How to Run

### Windows

#### Step 1: Download the files

Click the green **Code** button at the top right of this page → Select **Download ZIP** and download it.

**Extract the ZIP** to wherever you like.
Example: `C:\Users\YourName\Documents\puniq-prompt-asset-manager`

---

#### Step 2: Edit the bat file path

Inside the extracted folder, find `start_puniq_pam.bat`.
**Right-click it → Open with Notepad** and look for this line:

```
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager
```

**Replace it with the actual path** where you extracted the folder, then save the file.

> 💡 **How to find your path:** Open the folder in Explorer, then click the address bar at the top — it will show the full path. Copy and paste it.

---

#### Step 3: Run npm install (first time only)

Open **Command Prompt** (search "cmd" in the Start menu) and run:

```bash
cd "C:\paste-your-path-here"
npm install
```

---

#### Step 4: Launch the app

**Double-click** `start_puniq_pam.bat` — your browser will open automatically.

> From the second time onwards, just double-click to launch!

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

| Data | Storage |
|---|---|
| Prompt text | Browser localStorage (on your PC) |
| Thumbnail images | Browser IndexedDB (on your PC) |

> ⚠️ Clearing your browser cache will delete your data. Export regularly to keep backups.

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

- **Node.js**（建議版本 18 以上）
  - 確認是否已安裝：開啟終端機輸入 `node -v`，若顯示版本號即表示已安裝
  - 尚未安裝？→ 請至 [nodejs.org](https://nodejs.org/) 下載 **LTS 版本**

---

## 啟動方式

### Windows

#### 步驟 1：下載檔案

點擊本頁右上角的綠色「**Code**」按鈕 →「**Download ZIP**」下載。

將 ZIP 解壓縮到您喜歡的位置。
例如：`C:\Users\您的名稱\Documents\puniq-prompt-asset-manager`

---

#### 步驟 2：修改 bat 檔案的路徑

在解壓縮的資料夾中找到 `start_puniq_pam.bat`。
**右鍵 → 用記事本開啟**，找到以下這行：

```
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager
```

**將這行改成您自己解壓縮的資料夾路徑**，然後儲存檔案。

> 💡 **如何找到路徑：** 在檔案總管中開啟資料夾，點擊上方的網址列，就會顯示完整路徑。複製貼上即可。

---

#### 步驟 3：執行 npm install（僅第一次）

開啟**命令提示字元**（在開始選單搜尋「cmd」），執行：

```bash
cd "C:\貼上您的路徑"
npm install
```

---

#### 步驟 4：啟動應用程式

**雙擊** `start_puniq_pam.bat`，瀏覽器會自動開啟。

> 第二次之後只需雙擊即可啟動！

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

| 資料 | 儲存位置 |
|---|---|
| 提示詞文字 | 瀏覽器 localStorage（您的電腦內） |
| 縮圖圖片 | 瀏覽器 IndexedDB（您的電腦內） |

> ⚠️ 清除瀏覽器快取將會刪除所有資料。請定期匯出備份。

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

- **Node.js** (versión 18 o superior recomendada)
  - Para comprobar si está instalado: abre una terminal y escribe `node -v`. Si aparece un número de versión, ya lo tienes.
  - ¿No lo tienes instalado? → Descarga la **versión LTS** desde [nodejs.org](https://nodejs.org/)

---

## Cómo ejecutarlo

### Windows

#### Paso 1: Descargar los archivos

Haz clic en el botón verde **Code** en la parte superior derecha de esta página → Selecciona **Download ZIP** y descárgalo.

**Extrae el ZIP** donde quieras.
Ejemplo: `C:\Users\TuNombre\Documents\puniq-prompt-asset-manager`

---

#### Paso 2: Editar la ruta en el archivo bat

Dentro de la carpeta extraída, busca `start_puniq_pam.bat`.
**Haz clic derecho → Abrir con Bloc de notas** y busca esta línea:

```
cd /d C:\Users\YourName\Documents\puniq-prompt-asset-manager
```

**Reemplázala con la ruta real** donde extrajiste la carpeta y guarda el archivo.

> 💡 **Cómo encontrar tu ruta:** Abre la carpeta en el Explorador de archivos y haz clic en la barra de direcciones — mostrará la ruta completa. Cópiala y pégala.

---

#### Paso 3: Ejecutar npm install (solo la primera vez)

Abre el **Símbolo del sistema** (busca "cmd" en el menú Inicio) y ejecuta:

```bash
cd "C:\pega-tu-ruta-aquí"
npm install
```

---

#### Paso 4: Iniciar la aplicación

**Haz doble clic** en `start_puniq_pam.bat` — el navegador se abrirá automáticamente.

> ¡A partir de la segunda vez, solo haz doble clic para iniciar!

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

| Datos | Almacenamiento |
|---|---|
| Texto de los prompts | localStorage del navegador (en tu ordenador) |
| Imágenes en miniatura | IndexedDB del navegador (en tu ordenador) |

> ⚠️ Si borras la caché del navegador, perderás todos los datos. Exporta regularmente para hacer copias de seguridad.

---

## Licencia

MIT License © 2026 PuniQ
