import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

const STORAGE_KEY = "puniq_prompt_asset_manager_v1";
const DB_NAME = "puniq_prompt_asset_manager_images";
const STORE_NAME = "images";

const sampleItems = [
  {
    id: "sample-1",
    title: "春花畑_白ワンピ帽子",
    tags: ["春", "花畑", "白ワンピ", "帽子"],
    positive:
      "masterpiece, anime illustration, spring flower field, white one-piece dress, holding straw hat, wind blowing, flower petals, soft sunlight",
    negative:
      "low quality, blurry, bad anatomy, extra fingers, text, watermark, logo",
    hasImage: false,
    favorite: false,
    createdAt: new Date().toLocaleString(),
  },
];

export default function App() {
  const [items, setItems] = useState(sampleItems);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    tagsText: "",
    tagDraft: "",
    positive: "",
    negative: "",
    imageFile: null,
    imagePreview: "",
    imageFileName: "",
  });
  const [imageMap, setImageMap] = useState({});
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        setItems(sampleItems);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    const toLoad = items.filter((item) => item.hasImage && !imageMap[item.id]);
    if (toLoad.length === 0) return;

    let cancelled = false;
    (async () => {
      const next = { ...imageMap };
      for (const item of toLoad) {
        const img = await getImage(item.id);
        if (img) next[item.id] = img;
      }
      if (!cancelled) setImageMap(next);
    })();

    return () => { cancelled = true; };
  }, [items]);

  function showStatus(message) {
    setStatus(message);
    window.setTimeout(() => {
      setStatus("");
    }, 2200);
  }

  const tagPreview = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return items.filter((item) => {
      if (onlyFavorite && !item.favorite) return false;
      if (!q) return true;

      return [item.title, item.positive, item.negative, ...(item.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, onlyFavorite]);


  function commitTagFromDraft() {
    const draft = (form.tagDraft || "").trim();
    if (!draft) return;

    const currentTags = parseTags(form.tagsText);
    if (!currentTags.includes(draft)) {
      setForm((current) => ({
        ...current,
        tagsText: [...currentTags, draft].join(", "),
        tagDraft: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      tagDraft: "",
    }));
  }

  function removeTag(targetTag) {
    const nextTags = parseTags(form.tagsText).filter((tag) => tag !== targetTag);
    setForm((current) => ({
      ...current,
      tagsText: nextTags.join(", "),
    }));
  }

  function handleTagDraftChange(value) {
    if (value.includes(",") || value.includes("、")) {
      const parts = value
        .split(/[、,]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);

      const currentTags = parseTags(form.tagsText);
      const merged = [...currentTags];

      for (const tag of parts) {
        if (!merged.includes(tag)) merged.push(tag);
      }

      setForm((current) => ({
        ...current,
        tagsText: merged.join(", "),
        tagDraft: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      tagDraft: value,
    }));
  }

  function handleTagKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTagFromDraft();
    }

    if (event.key === "Backspace" && !(form.tagDraft || "")) {
      const currentTags = parseTags(form.tagsText);
      if (currentTags.length === 0) return;

      setForm((current) => ({
        ...current,
        tagsText: currentTags.slice(0, -1).join(", "),
      }));
    }
  }

  const handleImageChange = async (event) => {
    const inputElement = event.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    try {
      const resized = await resizeImage(file);
      setForm((current) => ({
        ...current,
        imageFile: file,
        imagePreview: resized,
        imageFileName: file.name,
      }));
      showStatus("サムネイル画像を選択しました");
      inputElement.value = "";
    } catch {
      showStatus("画像の読み込みに失敗しました");
    }
  };

  const savePrompt = async (event) => {
    event.preventDefault();

    try {
      const id = editingId || makeSafeId();
      const newItem = {
        id,
        title: form.title.trim() || "無題プロンプト",
        tags: parseTags([...parseTags(form.tagsText), (form.tagDraft || "").trim()].filter(Boolean).join(", ")),
        positive: form.positive,
        negative: form.negative,
        hasImage: Boolean(form.imagePreview),
        favorite: false,
        createdAt: new Date().toLocaleString(),
      };

      if (form.imagePreview) {
        await saveImage(id, form.imagePreview);
      }

      setItems((current) => {
        if (editingId) {
          return current.map((item) =>
            item.id === editingId ? { ...newItem, favorite: item.favorite || false } : item
          );
        }
        return [newItem, ...current];
      });
      setForm({
        title: "",
        tagsText: "",
        tagDraft: "",
        positive: "",
        negative: "",
        imageFile: null,
        imagePreview: "",
        imageFileName: "",
      });
      setEditingId(null);
      showStatus(editingId ? "編集を保存しました" : "保存しました");
    } catch (error) {
      console.error(error);
      showStatus("保存に失敗しました");
    }
  };

  async function editItem(item) {
    const preview = item.hasImage ? await getImage(item.id) : "";

    setEditingId(item.id);
    setForm({
      title: item.title || "",
      tagsText: (item.tags || []).join(", "),
      tagDraft: "",
      positive: item.positive || "",
      negative: item.negative || "",
      imageFile: null,
      imagePreview: preview || "",
      imageFileName: preview ? "保存済みサムネイル" : "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    showStatus("編集モードに入りました");
  }


  const saveAsNewPrompt = async () => {
    try {
      const id = makeSafeId();
      const pendingTags = [...parseTags(form.tagsText), (form.tagDraft || "").trim()]
        .filter(Boolean);

      const newItem = {
        id,
        title: form.title.trim() || "無題プロンプト",
        tags: parseTags(pendingTags.join(", ")),
        positive: form.positive,
        negative: form.negative,
        hasImage: Boolean(form.imagePreview),
        favorite: false,
        createdAt: new Date().toLocaleString(),
      };

      if (form.imagePreview) {
        await saveImage(id, form.imagePreview);
      }

      setItems((current) => [newItem, ...current]);
      setEditingId(null);
      setForm({
        title: "",
        tagsText: "",
        tagDraft: "",
        positive: "",
        negative: "",
        imageFile: null,
        imagePreview: "",
        imageFileName: "",
      });
      showStatus("新規として保存しました");
    } catch (error) {
      console.error(error);
      showStatus("新規保存に失敗しました");
    }
  };

  function toggleFavorite(id) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      )
    );
  }

  const deleteItem = async (id) => {
    await deleteImage(id);
    setItems((current) => current.filter((item) => item.id !== id));
    setImageMap((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    showStatus("削除しました");
  };

  const copyText = async (text, label = "Prompt") => {
    if (!text || !String(text).trim()) {
      showStatus(label + " は空欄です");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showStatus(label + " をコピーしました");
    } catch {
      showStatus("コピーに失敗しました");
    }
  };

  function escapeCsvValue(value) {
    const safeValue = String(value ?? "");
    return '"' + safeValue.replaceAll('"', '""') + '"';
  }

  function parseCsvText(csvText) {
    // 改行を含むクォートフィールドに対応するため、テキスト全体を1文字ずつパース
    const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = [];
    let current = "";
    let inQuotes = false;
    let row = [];

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const next = normalized[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if (char === "\n" && !inQuotes) {
        row.push(current);
        current = "";
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
      } else {
        current += char;
      }
    }

    // 末尾の残りを処理
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);

    // 1行目はヘッダーなのでスキップ
    return rows.slice(1);
  }

  function formatExportTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return (
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes())
    );
  }

  function sanitizeFileName(name) {
    return String(name || "untitled")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80);
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(",");
    const mimeMatch = meta.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  async function buildExportCsvRows(useImageFileName = false) {
    const header = ["タイトル", "PositivePrompt", "NegativePrompt", "タグ", "サムネイル画像", "お気に入り"];
    const rows = [header.map(escapeCsvValue).join(",")];
    const images = [];
    const usedFileNames = new Set();

    for (const item of items) {
      const image = item.hasImage ? await getImage(item.id) : "";

      let imageFileName = "";
      if (image) {
        const baseName = sanitizeFileName(item.title);
        let candidate = baseName + ".jpg";
        let counter = 1;
        while (usedFileNames.has(candidate)) {
          candidate = baseName + "(" + counter + ").jpg";
          counter++;
        }
        usedFileNames.add(candidate);
        imageFileName = candidate;

        images.push({
          fileName: imageFileName,
          dataUrl: image,
        });
      }

      rows.push(
        [
          item.title || "",
          item.positive || "",
          item.negative || "",
          (item.tags || []).join("、"),
          useImageFileName ? imageFileName : image || "",
          item.favorite ? "true" : "false",
        ]
          .map(escapeCsvValue)
          .join(",")
      );
    }

    return {
      csv: "\ufeff" + rows.join("\n"),
      images,
    };
  }

  async function exportPromptsCsv() {
    const timestamp = formatExportTimestamp();
    const csvFileName = `${timestamp}_export.csv`;

    try {
      if (window.showDirectoryPicker) {
        const rootHandle = await window.showDirectoryPicker();
        const { csv, images } = await buildExportCsvRows(true);

        const exportFolderName = timestamp + "_export";
        const exportFolder = await rootHandle.getDirectoryHandle(exportFolderName, { create: true });

        const csvHandle = await exportFolder.getFileHandle(csvFileName, { create: true });
        const csvWritable = await csvHandle.createWritable();
        await csvWritable.write(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        await csvWritable.close();

        if (images.length > 0) {
          const thumbFolder = await exportFolder.getDirectoryHandle("thumbnails", { create: true });
          for (const image of images) {
            const imageHandle = await thumbFolder.getFileHandle(image.fileName, { create: true });
            const imageWritable = await imageHandle.createWritable();
            await imageWritable.write(dataUrlToBlob(image.dataUrl));
            await imageWritable.close();
          }
        }

        showStatus("CSVと画像をエクスポートしました");
        return;
      }

      // showDirectoryPicker非対応ブラウザ（Brave等）はZIPでダウンロード
      const { csv, images } = await buildExportCsvRows(true);
      const zip = new JSZip();
      const exportFolderName = timestamp + "_export";
      const folder = zip.folder(exportFolderName);

      folder.file(csvFileName, new Blob([csv], { type: "text/csv;charset=utf-8" }));

      if (images.length > 0) {
        const thumbFolder = folder.folder("thumbnails");
        for (const image of images) {
          const base64 = image.dataUrl.split(",")[1];
          thumbFolder.file(image.fileName, base64, { base64: true });
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob", encodeFileName: (name) => new TextEncoder().encode(name) });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportFolderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      showStatus("ZIPでエクスポートしました");
    } catch (error) {
      if (error?.name === "AbortError") {
        showStatus("エクスポートをキャンセルしました");
        return;
      }

      console.error(error);
      showStatus("エクスポートに失敗しました");
    }
  }

  async function importPromptsCsv(file) {
    if (!file) return;

    try {
      // ZIPファイルの場合
      if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);

        // ZIP内のCSVを探す
        const csvFile = Object.values(zip.files).find(
          (f) => !f.dir && f.name.endsWith(".csv")
        );
        if (!csvFile) {
          showStatus("ZIP内にCSVが見つかりませんでした");
          return;
        }

        // thumbnails/フォルダの画像をファイル名→data URLのマップに変換
        const thumbMap = {};
        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir && path.includes("thumbnails/")) {
            const fileName = path.split("/").pop();
            const blob = await zipEntry.async("blob");
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            thumbMap[fileName] = dataUrl;
          }
        }

        const csvText = await csvFile.async("string");
        const rows = parseCsvText(csvText);
        const importedItems = [];

        for (const row of rows) {
          const [title, positive, negative, tagsText, imageField, favoriteText] = row;
          const id = makeSafeId();

          // data URLかファイル名かを判定
          let validImage = "";
          if (imageField && imageField.startsWith("data:")) {
            validImage = imageField;
          } else if (imageField && thumbMap[imageField]) {
            validImage = thumbMap[imageField];
          }

          const newItem = {
            id,
            title: title || "無題プロンプト",
            positive: positive || "",
            negative: negative || "",
            tags: parseTags(tagsText || ""),
            hasImage: Boolean(validImage),
            favorite: favoriteText === "true",
            createdAt: new Date().toLocaleString(),
          };

          if (validImage) {
            await saveImage(id, validImage);
          }

          importedItems.push(newItem);
        }

        setItems((current) => [...importedItems, ...current]);
        showStatus(`ZIPから${importedItems.length}件インポートしました`);
        return;
      }

      // CSVファイルの場合
      const csvText = await file.text();
      const rows = parseCsvText(csvText);
      const importedItems = [];

      for (const row of rows) {
        const [title, positive, negative, tagsText, image, favoriteText] = row;
        const id = makeSafeId();

        // data URLのみ有効な画像として扱う（ファイル名文字列はスキップ）
        const validImage = image && image.startsWith("data:") ? image : "";

        const newItem = {
          id,
          title: title || "無題プロンプト",
          positive: positive || "",
          negative: negative || "",
          tags: parseTags(tagsText || ""),
          hasImage: Boolean(validImage),
          favorite: favoriteText === "true",
          createdAt: new Date().toLocaleString(),
        };

        if (validImage) {
          await saveImage(id, validImage);
        }

        importedItems.push(newItem);
      }

      setItems((current) => [...importedItems, ...current]);
      showStatus(`CSVから${importedItems.length}件インポートしました`);
    } catch (error) {
      console.error(error);
      showStatus("インポートに失敗しました");
    }
  }


  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <span style={styles.brand}>PuniQ</span> Prompt Asset Manager
          </h1>
          <p style={styles.subtitle}>AIイラスト用Prompt Assetを保存・検索・管理</p>
        </div>

        <div style={styles.headerTools}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索"
              style={styles.searchInput}
            />
          </div>

          <label style={styles.toolButton}>
            📥 Import
            <input
              type="file"
              accept=".csv,text/csv,.zip"
              onChange={(e) => {
                importPromptsCsv(e.target.files?.[0]);
                e.target.value = "";
              }}
              style={styles.fileInput}
            />
          </label>

          <button type="button" onClick={exportPromptsCsv} style={styles.toolButton}>
            📤 Export
          </button>
        </div>
      </header>

      {status && <div style={styles.statusToast}>{status}</div>}

      {confirmDeleteId && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmDialog}>
            <p style={styles.confirmText}>🗑️ このプロンプトを削除しますか？</p>
            <div style={styles.confirmButtons}>
              <button
                type="button"
                onClick={() => {
                  deleteItem(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                style={styles.confirmDeleteButton}
              >
                削除する
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                style={styles.confirmCancelButton}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <section style={styles.formArea}>
        <h2 style={styles.sectionTitle}>プロンプト記入エリア</h2>

        <form onSubmit={savePrompt} style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>タイトル</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例：春花畑_白ワンピ帽子"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>タグ</span>
            <div>
              <div style={styles.tagInputBox}>
                {tagPreview.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => copyText(tag, `#${tag}`)}
                    style={styles.tagChipInInput}
                    title="クリックでコピー（削除はBackspace）"
                  >
                    #{tag}
                  </button>
                ))}

                <input
                  value={form.tagDraft || ""}
                  onChange={(e) => handleTagDraftChange(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={commitTagFromDraft}
                  placeholder={tagPreview.length === 0 ? "カンマでタグ化：春, 花畑, 白ワンピ" : "タグを追加"}
                  style={styles.tagDraftInput}
                />
              </div>
              <div style={styles.tagGuide}>
                カンマ「,」を打つとタグとして確定します。タグをクリックすると削除できます。
              </div>
            </div>
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Positive Prompt</span>
            <textarea
              value={form.positive}
              onChange={(e) => setForm({ ...form, positive: e.target.value })}
              placeholder="ここにPositive Promptを入力"
              required
              style={styles.textarea}
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Negative Prompt</span>
            <textarea
              value={form.negative}
              onChange={(e) => setForm({ ...form, negative: e.target.value })}
              placeholder="ここにNegative Promptを入力"
              style={styles.textareaSmall}
            />
          </label>

          <div style={styles.bottomRow}>
            <div />
            <div style={styles.imageSelectArea}>
              <div style={styles.thumbnailPickerWrap}>
                <label style={form.imagePreview ? styles.fileLabelSelected : styles.fileLabel}>
                  {form.imagePreview ? (
                    <>
                      <img src={form.imagePreview} alt="" style={styles.uploadPreviewImage} />
                      <span style={styles.fileTitle}>画像を変更</span>
                      <span style={styles.fileNote}>{form.imageFileName}</span>
                    </>
                  ) : (
                    <>
                      <span style={styles.fileTitle}>サムネイル画像を選択</span>
                      <span style={styles.fileNote}>JPG / PNG / WebP</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={styles.fileInput}
                  />
                </label>

                {form.imagePreview && (
                  <button
                    type="button"
                    aria-label="サムネイル画像を外す"
                    title="サムネイル画像を外す"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setForm({
                        ...form,
                        imageFile: null,
                        imagePreview: "",
                        imageFileName: "",
                      });
                    }}
                    style={styles.thumbnailRemoveButton}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div style={styles.saveButtonGroup}>
              <button type="submit" style={styles.saveButton}>
                {editingId ? "編集を保存" : "プロンプトを保存"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={saveAsNewPrompt}
                  style={styles.saveAsButton}
                >
                  新規として保存
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <div style={styles.divider}>
        <span style={styles.dividerText}>保存したプロンプト一覧</span>
        <button
          type="button"
          onClick={() => setOnlyFavorite((value) => !value)}
          style={onlyFavorite ? styles.favoriteFilterButtonActive : styles.favoriteFilterButton}
        >
          ❤ お気に入り
        </button>
      </div>

      <main style={styles.gallery}>
        {filtered.map((item) => (
          <article key={item.id} style={styles.card}>
            <button
              type="button"
              onClick={() => toggleFavorite(item.id)}
              style={item.favorite ? styles.favoriteButtonActive : styles.favoriteButton}
              title={item.favorite ? "お気に入り解除" : "お気に入りに追加"}
            >
              ❤
            </button>

            {imageMap[item.id] ? (
              <img src={imageMap[item.id]} alt="" style={styles.cardFullImage} />
            ) : (
              <div style={styles.noImageFull}>No Thumbnail</div>
            )}

            <div style={styles.fullOverlay}>
              <div>
                <div style={styles.cardTitle}>{item.title}</div>

                <div style={styles.tags}>
                  {getVisibleTags(item.tags).visible.map((tag) => (
                    <span key={tag} style={styles.tag}>
                      #{tag}
                    </span>
                  ))}
                  {getVisibleTags(item.tags).hiddenCount > 0 && (
                    <span style={styles.tagMore}>…</span>
                  )}
                </div>

                <div style={styles.date}>{item.createdAt}</div>
              </div>

              <div style={styles.buttons}>
                <button
                  onClick={() => copyText(item.positive, "Positive Prompt")}
                  style={styles.cardWideButton}
                >
                  📋 Positive
                </button>

                <button
                  onClick={() => copyText(item.negative, "Negative Prompt")}
                  style={styles.cardWideButton}
                >
                  📋 Negative
                </button>
              </div>

              <div style={styles.cardActionIcons}>
                <button
                  onClick={() => editItem(item)}
                  style={styles.cardIconButton}
                  title="編集"
                >
                  📝
                </button>

                <button
                  onClick={() => setConfirmDeleteId(item.id)}
                  style={styles.cardDeleteIconButton}
                  title="削除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}


function getVisibleTags(tags, maxCount = 5, maxChars = 25) {
  const safeTags = Array.isArray(tags) ? tags : [];
  const visible = [];
  let totalChars = 0;

  for (const tag of safeTags) {
    if (visible.length >= maxCount) break;
    if (totalChars + tag.length > maxChars) break;
    visible.push(tag);
    totalChars += tag.length;
  }

  return {
    visible,
    hiddenCount: Math.max(0, safeTags.length - visible.length),
  };
}

function parseTags(text) {
  return String(text || "")
    .split(/[、,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function makeSafeId() {
  return "prompt-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function resizeImage(file, maxWidth = 760, quality = 0.68) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = reject;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveImage(id, dataUrl) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function getImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || "");
    request.onerror = reject;
  });
}

async function deleteImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

const styles = {

  favoriteFilterButton: {
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "12px",
    background: "rgba(25,29,37,0.92)",
    color: "#fff",
    padding: "0 12px",
    height: "40px",
    boxSizing: "border-box",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    lineHeight: 1,
    verticalAlign: "baseline",
  },

  favoriteFilterButtonActive: {
    border: "1px solid rgba(255,122,184,0.75)",
    borderRadius: "12px",
    background: "rgba(255,79,163,0.22)",
    color: "#ffd7ea",
    padding: "0 12px",
    height: "40px",
    boxSizing: "border-box",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    lineHeight: 1,
    verticalAlign: "baseline",
  },

  favoriteButton: {
    position: "absolute",
    top: "12px",
    left: "12px",
    zIndex: 3,
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(15,18,26,0.86)",
    color: "rgba(255,255,255,0.82)",
    fontSize: "22px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  },

  favoriteButtonActive: {
    position: "absolute",
    top: "12px",
    left: "12px",
    zIndex: 3,
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "1px solid rgba(255,122,184,0.75)",
    background: "rgba(255,79,163,0.25)",
    color: "#ff7ab8",
    fontSize: "22px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  },



  headerTools: {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    alignItems: "center",
    justifyContent: "flex-end",
    width: "52%",
    minWidth: "520px",
  },


  toolButton: {
    border: "1px solid #343844",
    borderRadius: "12px",
    background: "rgba(25,29,37,0.92)",
    color: "#fff",
    padding: "0 12px",
    height: "40px",
    boxSizing: "border-box",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    font: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },



  tagInputBox: {
    width: "100%",
    minHeight: "44px",
    boxSizing: "border-box",
    border: "1px solid #353842",
    borderRadius: "12px",
    background: "#12151b",
    padding: "6px 8px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },

  tagDraftInput: {
    flex: "1 1 160px",
    minWidth: "140px",
    height: "30px",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "14px",
  },

  tagChipInInput: {
    border: "1px solid rgba(255,122,184,0.45)",
    background: "rgba(255,122,184,0.14)",
    color: "#ffd7ea",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "13px",
    cursor: "pointer",
  },

  tagGuide: {
    marginTop: "7px",
    color: "#858a96",
    fontSize: "12px",
    textAlign: "left",
    paddingLeft: "2px",
  },

  tagMore: {
    fontSize: "12px",
    color: "#f2f3f6",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(0,0,0,0.38)",
    borderRadius: "999px",
    padding: "3px 8px",
  },



  cardWideButton: {
    border: "1px solid #343844",
    borderRadius: "12px",
    background: "rgba(15,18,26,0.88)",
    color: "#fff",
    padding: "14px 12px",
    cursor: "pointer",
    fontWeight: 700,
    width: "100%",
  },

  cardActionIcons: {
    position: "absolute",
    top: "12px",
    right: "12px",
    display: "flex",
    gap: "10px",
  },

  cardIconButton: {
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(15,18,26,0.86)",
    color: "#fff",
    fontSize: "20px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  },

  cardDeleteIconButton: {
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "1px solid rgba(255,120,140,0.45)",
    background: "rgba(80,10,20,0.75)",
    color: "#ffd7df",
    fontSize: "18px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  },

  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at top left, rgba(255,79,163,0.12), transparent 32%), #08090d",
    color: "#f5f5f7",
    padding: "24px",
    fontFamily:
      '"Segoe UI", "Yu Gothic UI", "Hiragino Sans", "Meiryo", sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "14px",
  },
  title: { margin: 0, fontSize: "32px", lineHeight: 1.1 },
  brand: { color: "#ff7ab8" },
  subtitle: {
    margin: "10px 0 0 0",
    color: "#d7d9df",
    fontSize: "16px",
    textAlign: "left",
    paddingLeft: "0px",
  },
  searchWrap: {
    flex: "1 1 300px",
    minWidth: "260px",
    maxWidth: "420px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxSizing: "border-box",
    border: "1px solid #30323a",
    background: "rgba(255,255,255,0.055)",
    borderRadius: "14px",
    padding: "0 12px",
    height: "40px",
  
  },
  searchIcon: { opacity: 0.75 },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 0",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "14px",
  },
  statusToast: {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9999,
    background: "rgba(18,21,27,0.96)",
    border: "1px solid rgba(255,122,184,0.45)",
    color: "#ffd7ea",
    borderRadius: "16px",
    padding: "14px 20px",
    boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
    fontSize: "15px",
    fontWeight: 700,
    pointerEvents: "none",
  },
  confirmOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDialog: {
    background: "rgba(18,21,27,0.98)",
    border: "1px solid rgba(255,122,184,0.45)",
    borderRadius: "20px",
    padding: "28px 32px",
    boxShadow: "0 14px 36px rgba(0,0,0,0.5)",
    minWidth: "300px",
    textAlign: "center",
  },
  confirmText: {
    color: "#ffd7ea",
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "22px",
  },
  confirmButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  },
  confirmDeleteButton: {
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: "1px solid rgba(255,80,110,0.55)",
    background: "rgba(255,80,110,0.15)",
    color: "#ff6f91",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmCancelButton: {
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: "1px solid rgba(255,122,184,0.35)",
    background: "rgba(255,122,184,0.1)",
    color: "#ffd7ea",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  formArea: {
    boxSizing: "border-box",
    border: "1px solid rgba(255,79,163,0.45)",
    background: "rgba(12,14,20,0.92)",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "28px",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.03), 0 18px 40px rgba(0,0,0,0.4)",
  },
  sectionTitle: { margin: "0 0 18px", fontSize: "20px" },
  form: { display: "grid", gap: "14px" },
  label: {
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr)",
    alignItems: "start",
    gap: "14px",
  },
  labelText: {
    fontWeight: 700,
    paddingTop: "10px",
    color: "#f3f3f5",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "44px",
    border: "1px solid #353842",
    borderRadius: "12px",
    background: "#12151b",
    color: "#fff",
    padding: "0 14px",
    fontSize: "14px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "100px",
    resize: "vertical",
    border: "1px solid #353842",
    borderRadius: "12px",
    background: "#12151b",
    color: "#fff",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    lineHeight: 1.5,
  },
  textareaSmall: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "76px",
    resize: "vertical",
    border: "1px solid #353842",
    borderRadius: "12px",
    background: "#12151b",
    color: "#fff",
    padding: "12px 14px",
    fontSize: "14px",
    outline: "none",
    lineHeight: 1.5,
  },
  bottomRow: {
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr) auto",
    alignItems: "start",
    gap: "14px",
  },
  imageSelectArea: {
    display: "grid",
    gap: "10px",
  },
  thumbnailPickerWrap: {
    position: "relative",
  },
  fileLabelSelected: {
    boxSizing: "border-box",
    minHeight: "280px",
    border: "1px solid rgba(255,122,184,0.65)",
    borderRadius: "14px",
    background: "rgba(255,122,184,0.08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "12px",
  },
  uploadPreviewImage: {
    width: "420px",
    maxWidth: "100%",
    height: "220px",
    objectFit: "contain",
    borderRadius: "10px",
    display: "block",
    background: "#0d0f14",
  },
  thumbnailRemoveButton: {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "30px",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  },
  fileLabel: {
    boxSizing: "border-box",
    minHeight: "72px",
    border: "1px dashed #565a66",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.035)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    cursor: "pointer",
  },
  fileTitle: { color: "#ff7ab8", fontWeight: 700 },
  fileNote: { color: "#a9acb7", fontSize: "12px" },
  fileInput: { display: "none" },
  saveButtonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "stretch",
  },
  saveAsButton: {
    minWidth: "170px",
    height: "46px",
    border: "1px solid rgba(120,180,255,0.45)",
    borderRadius: "14px",
    background: "rgba(120,180,255,0.14)",
    color: "#cfe3ff",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
  },
  saveButton: {
    minWidth: "170px",
    height: "50px",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #ff4fa3, #ff6f91)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
  },
  divider: {
    display: "flex",
    alignItems: "baseline",
    gap: "14px",
    margin: "10px 0 18px",
    borderTop: "1px solid rgba(255,255,255,0.16)",
    paddingTop: "18px",
  },
  dividerText: { whiteSpace: "nowrap", color: "#f1f1f4", fontWeight: 700 },
  gallery: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
    gap: "18px",
  },
  card: {
    overflow: "hidden",
    border: "1px solid #282b34",
    borderRadius: "18px",
    background: "#11141a",
    boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
    position: "relative",
    minHeight: "360px",
  },
  cardFullImage: {
    width: "100%",
    height: "100%",
    minHeight: "360px",
    objectFit: "cover",
    display: "block",
  },
  noImageFull: {
    minHeight: "360px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6f7482",
    fontSize: "14px",
    background: "#1b1e26",
  },
  fullOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "96px 12px 12px",
    background: "linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.04) 75%)",
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: "15px",
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    textShadow: "0 1px 2px rgba(0,0,0,0.9)",
  },
  tags: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" },
  tag: {
    fontSize: "12px",
    color: "#f2f3f6",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(0,0,0,0.38)",
    borderRadius: "999px",
    padding: "3px 8px",
  },
  date: { color: "#d4d6df", fontSize: "12px", marginBottom: "0", textShadow: "0 1px 2px rgba(0,0,0,0.9)" },
  buttons: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
};
