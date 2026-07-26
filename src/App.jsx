import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

const STORAGE_KEY = "puniq_prompt_asset_manager_v1";
const DB_NAME = "puniq_prompt_asset_manager_images";
const STORE_NAME = "images";
const SORT_ORDER_KEY = "puniq_sort_order";
const COL_COUNT_KEY = "puniq_col_count";
const LOCAL_STORAGE_API = "/api/local-storage";
const DEFAULT_SORT_ORDER = "newest";
const DEFAULT_COL_COUNT = 4;
const EXPORT_THUMBNAILS_DIR = "thumbnails";
const DESKTOP_SPLIT_MIN_WIDTH = 1280;
const MOBILE_BREAKPOINT = 900;
const APP_VERSION = "v1.4.0";
let localFileStorageEnabled = false;
const EMPTY_FORM = {
  title: "",
  tagsText: "",
  tagDraft: "",
  positive: "",
  negative: "",
  imageFile: null,
  imagePreview: "",
  imageFileName: "",
};

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
  const [storageMode, setStorageMode] = useState("checking");
  const [migrationNotice, setMigrationNotice] = useState(false);
  const skipNextLocalSave = useRef(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageMap, setImageMap] = useState({});
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [resetConfirmStep, setResetConfirmStep] = useState(0);
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem(SORT_ORDER_KEY) || DEFAULT_SORT_ORDER);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [colCount, setColCount] = useState(() => Number(localStorage.getItem(COL_COUNT_KEY)) || DEFAULT_COL_COUNT);
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === "undefined") return DESKTOP_SPLIT_MIN_WIDTH;
    return window.innerWidth;
  });
  const [isDesktopSplit, setIsDesktopSplit] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= DESKTOP_SPLIT_MIN_WIDTH;
  });
  const isMobileView = viewportWidth < MOBILE_BREAKPOINT;
  const displayColCount = isMobileView ? 2 : colCount;
  const colOptions = [4, 5, 6, 7, 8];
  const selectedColButton = colCount;
  const useDenseCardButtons =
    (displayColCount >= 7) ||
    (displayColCount >= 6 && viewportWidth < 1700) ||
    (displayColCount >= 5 && viewportWidth < 1300);
  const sortOrderLabel =
    sortOrder === "newest"
      ? "新しい順"
      : sortOrder === "oldest"
        ? "古い順"
        : sortOrder === "favorite"
          ? "お気に入り優先"
          : "タイトル順";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const browserState = loadBrowserState();
      const browserItems = browserState.items;
      const browserSortOrder = localStorage.getItem(SORT_ORDER_KEY) || DEFAULT_SORT_ORDER;
      const browserColCount = Number(localStorage.getItem(COL_COUNT_KEY)) || DEFAULT_COL_COUNT;

      try {
        const stored = await loadLocalFileData();
        localFileStorageEnabled = true;

        if (stored.exists) {
          const data = stored.data;
          if (!cancelled) {
            setItems(data.items);
            setSortOrder(data.sortOrder || DEFAULT_SORT_ORDER);
            setColCount(Number(data.colCount) || DEFAULT_COL_COUNT);
          }
        } else if (browserState.hasStoredData) {
          for (const item of browserItems) {
            if (!item.hasImage) continue;
            try {
              const image = await getBrowserImage(item.id);
              if (image) await saveLocalFileImage(item.id, image);
            } catch (error) {
              console.warn(`Could not migrate image ${item.id}; prompt migration will continue.`, error);
            }
          }

          await saveLocalFileData({
            version: 1,
            items: browserItems,
            sortOrder: browserSortOrder,
            colCount: browserColCount,
          });

          if (!cancelled) {
            setItems(browserItems);
            setSortOrder(browserSortOrder);
            setColCount(browserColCount);
            showStatus("ブラウザのデータをローカル保存へ移行しました");
          }
        } else if (!cancelled) {
          skipNextLocalSave.current = true;
          setItems(browserItems);
          setSortOrder(browserSortOrder);
          setColCount(browserColCount);
          setMigrationNotice(true);
        }

        if (!cancelled) setStorageMode("local");
      } catch (error) {
        console.warn("Local file storage is unavailable; using browser storage.", error);
        localFileStorageEnabled = false;
        if (!cancelled) {
          setItems(browserItems);
          setSortOrder(browserSortOrder);
          setColCount(browserColCount);
          setStorageMode("browser");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
    localStorage.setItem(COL_COUNT_KEY, String(colCount));

    let saveTimer = null;
    if (storageMode === "local") {
      if (skipNextLocalSave.current) {
        skipNextLocalSave.current = false;
      } else {
        saveTimer = window.setTimeout(() => {
          saveLocalFileData({
            version: 1,
            items,
            sortOrder,
            colCount,
          }).then(() => {
            setMigrationNotice(false);
          }).catch((error) => {
            console.error(error);
            setStorageMode("error");
          });
        }, 200);
      }
    }

    const toLoad = items.filter((item) => item.hasImage && !imageMap[item.id]);
    let cancelled = false;
    if (toLoad.length > 0) {
      (async () => {
        const next = { ...imageMap };
        for (const item of toLoad) {
          const img = await getImage(item.id);
          if (img) next[item.id] = img;
        }
        if (!cancelled) setImageMap(next);
      })();
    }

    return () => {
      cancelled = true;
      if (saveTimer) window.clearTimeout(saveTimer);
    };
  }, [items, sortOrder, colCount, loaded, storageMode, imageMap]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handler = (e) => {
      if (!e.target.closest("[data-sort-wrap]")) setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setIsDesktopSplit(window.innerWidth >= DESKTOP_SPLIT_MIN_WIDTH);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function showStatus(message) {
    setStatus(message);
    window.setTimeout(() => {
      setStatus("");
    }, 2200);
  }

  const tagPreview = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    const result = items.filter((item) => {
      if (onlyFavorite && !item.favorite) return false;
      if (!q) return true;

      return [item.title, item.positive, item.negative, ...(item.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sortOrder === "oldest") {
      return [...result].reverse();
    } else if (sortOrder === "favorite") {
      return [...result].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    } else if (sortOrder === "title") {
      return [...result].sort((a, b) => (a.title || "").localeCompare(b.title || "", "ja"));
    }
    return result;
  }, [items, query, onlyFavorite, sortOrder]);


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
      const hasImagePreview = Boolean(form.imagePreview);
      const newItem = {
        id,
        title: form.title.trim() || "無題プロンプト",
        tags: parseTags([...parseTags(form.tagsText), (form.tagDraft || "").trim()].filter(Boolean).join(", ")),
        positive: form.positive,
        negative: form.negative,
        hasImage: hasImagePreview,
        favorite: false,
        createdAt: new Date().toLocaleString(),
      };

      if (hasImagePreview) {
        await saveImage(id, form.imagePreview);
      } else if (editingId) {
        await deleteImage(id);
      }

      setImageMap((current) => {
        const next = { ...current };
        if (hasImagePreview) {
          next[id] = form.imagePreview;
        } else {
          delete next[id];
        }
        return next;
      });

      setItems((current) => {
        if (editingId) {
          return current.map((item) =>
            item.id === editingId ? { ...newItem, favorite: item.favorite || false } : item
          );
        }
        return [newItem, ...current];
      });
      setForm(EMPTY_FORM);
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
      const hasImagePreview = Boolean(form.imagePreview);

      const newItem = {
        id,
        title: form.title.trim() || "無題プロンプト",
        tags: parseTags(pendingTags.join(", ")),
        positive: form.positive,
        negative: form.negative,
        hasImage: hasImagePreview,
        favorite: false,
        createdAt: new Date().toLocaleString(),
      };

      if (hasImagePreview) {
        await saveImage(id, form.imagePreview);
        setImageMap((current) => ({
          ...current,
          [id]: form.imagePreview,
        }));
      }

      setItems((current) => [newItem, ...current]);
      setEditingId(null);
      setForm(EMPTY_FORM);
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

  async function clearAllData() {
    try {
      await deleteAllImages();
      if (localFileStorageEnabled) {
        await saveLocalFileData({
          version: 1,
          items: [],
          sortOrder: DEFAULT_SORT_ORDER,
          colCount: DEFAULT_COL_COUNT,
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      localStorage.removeItem(SORT_ORDER_KEY);
      localStorage.removeItem(COL_COUNT_KEY);

      setItems([]);
      setImageMap({});
      setQuery("");
      setForm(EMPTY_FORM);
      setEditingId(null);
      setOnlyFavorite(false);
      setSortMenuOpen(false);
      setConfirmDeleteId(null);
      setSortOrder(DEFAULT_SORT_ORDER);
      setColCount(DEFAULT_COL_COUNT);
      setResetConfirmStep(0);

      showStatus("全データを初期化しました");
    } catch (error) {
      console.error(error);
      showStatus("初期化に失敗しました");
    }
  }

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

  function getImageMimeType(fileName) {
    const extension = String(fileName || "").toLowerCase().split(".").pop();
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    if (extension === "gif") return "image/gif";
    if (extension === "avif") return "image/avif";
    return "image/jpeg";
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
          useImageFileName && imageFileName ? `${EXPORT_THUMBNAILS_DIR}/${imageFileName}` : image || "",
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
    const exportFolderName = timestamp + "_export";
    const zipFileName = `${exportFolderName}.zip`;

    try {
      let saveHandle = null;
      if ("showSaveFilePicker" in window) {
        saveHandle = await window.showSaveFilePicker({
          id: "puniq-prompt-asset-manager-export",
          suggestedName: zipFileName,
          types: [
            {
              description: "ZIPアーカイブ",
              accept: { "application/zip": [".zip"] },
            },
          ],
        });
      }

      const { csv, images } = await buildExportCsvRows(true);
      const zip = new JSZip();
      const folder = zip.folder(exportFolderName);

      folder.file(csvFileName, new Blob([csv], { type: "text/csv;charset=utf-8" }));

      if (images.length > 0) {
        const thumbFolder = folder.folder(EXPORT_THUMBNAILS_DIR);
        for (const image of images) {
          const base64 = image.dataUrl.split(",")[1];
          thumbFolder.file(image.fileName, base64, { base64: true });
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob", encodeFileName: (name) => new TextEncoder().encode(name) });
      if (saveHandle) {
        const writable = await saveHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipFileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

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
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);

        // ZIP内のCSVを探す
        const csvFile = Object.values(zip.files).find(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".csv")
        );
        if (!csvFile) {
          showStatus("ZIP内にCSVが見つかりませんでした");
          return;
        }

        // thumbnails/フォルダの画像をファイル名/相対パス→data URLのマップに変換
        const thumbMap = {};
        for (const [path, zipEntry] of Object.entries(zip.files)) {
          const normalizedPath = path.replace(/\\/g, "/");
          if (!zipEntry.dir && normalizedPath.toLowerCase().includes(`${EXPORT_THUMBNAILS_DIR}/`)) {
            const fileName = normalizedPath.split("/").pop();
            const base64 = await zipEntry.async("base64");
            const dataUrl = `data:${getImageMimeType(fileName)};base64,${base64}`;
            thumbMap[normalizedPath] = dataUrl;
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
          const normalizedImageField = String(imageField || "").trim().replace(/\\/g, "/");
          if (normalizedImageField && normalizedImageField.startsWith("data:")) {
            validImage = normalizedImageField;
          } else if (normalizedImageField) {
            const baseName = normalizedImageField.split("/").pop();
            validImage =
              thumbMap[normalizedImageField] ||
              thumbMap[baseName] ||
              "";
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
    <div style={isMobileView ? { ...styles.page, ...styles.pageMobile } : styles.page}>
      <header style={isMobileView ? { ...styles.header, ...styles.headerMobile } : styles.header}>
        <div>
          <h1 style={isMobileView ? { ...styles.title, ...styles.titleMobile } : styles.title}>
            <span style={styles.brand}>PuniQ</span> Prompt Asset Manager{" "}
            <span style={styles.versionBadge}>{APP_VERSION}</span>
          </h1>
          <p style={isMobileView ? { ...styles.subtitle, ...styles.subtitleMobile } : styles.subtitle}>AIイラスト用Prompt Assetを保存・検索・管理</p>
          {loaded && (storageMode !== "local" || migrationNotice) && (
            <div
              style={storageMode === "error" ? { ...styles.storageWarning, ...styles.storageWarningError } : styles.storageWarning}
              title={
                storageMode === "error"
                  ? "ローカルファイルへの保存に失敗しました。ブラウザ内のキャッシュは継続しています。"
                  : migrationNotice
                    ? "ローカル保存はまだ空です。以前のデータが別ブラウザにある場合は、そのブラウザで http://localhost:5173/ を開くと移行できます。"
                  : "BATを使わずに開いているため、データはこのブラウザ内だけに保存されます。"
              }
            >
              {storageMode === "error"
                ? "⚠ ローカル保存エラー"
                : migrationNotice
                  ? "⚠ 旧ブラウザから移行できます"
                  : "⚠ ブラウザ保存のみ"}
            </div>
          )}
        </div>

        <div style={isMobileView ? { ...styles.headerTools, ...styles.headerToolsMobile } : styles.headerTools}>
          <div style={isMobileView ? { ...styles.searchWrap, ...styles.searchWrapMobile } : styles.searchWrap}>
            <span style={styles.searchIcon}>🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索"
              style={styles.searchInput}
            />
          </div>

          <label style={isMobileView ? { ...styles.toolButton, ...styles.toolButtonMobile } : styles.toolButton}>
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

          <button type="button" onClick={exportPromptsCsv} style={isMobileView ? { ...styles.toolButton, ...styles.toolButtonMobile } : styles.toolButton}>
            📤 Export
          </button>

          <button
            type="button"
            onClick={() => setResetConfirmStep(1)}
            style={
              isMobileView
                ? { ...styles.toolButton, ...styles.toolButtonMobile, ...styles.dangerToolButton }
                : { ...styles.toolButton, ...styles.dangerToolButton }
            }
          >
            ⚠️ 全データ初期化
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

      {resetConfirmStep > 0 && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmDialog}>
            {resetConfirmStep === 1 ? (
              <>
                <p style={styles.confirmText}>⚠️ 全データ初期化の前にExport推奨です</p>
                <p style={styles.confirmSubText}>
                  保存済みのプロンプト・サムネイル・並び替え設定・列数設定が消えます。
                </p>
                <div style={styles.confirmButtons}>
                  <button
                    type="button"
                    onClick={exportPromptsCsv}
                    style={styles.confirmSupportButton}
                  >
                    先にExportする
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(2)}
                    style={styles.confirmProceedButton}
                  >
                    次へ進む
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setResetConfirmStep(0)}
                  style={styles.confirmCloseButton}
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <p style={styles.confirmText}>本当に全データを初期化しますか？</p>
                <p style={styles.confirmSubTextStrong}>
                  この操作は取り消せません。
                </p>
                <div style={styles.confirmButtons}>
                  <button
                    type="button"
                    onClick={clearAllData}
                    style={styles.confirmDeleteButton}
                  >
                    全データを初期化する
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(1)}
                    style={styles.confirmSupportButton}
                  >
                    戻る
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setResetConfirmStep(0)}
                  style={styles.confirmCloseButton}
                >
                  キャンセル
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={isDesktopSplit ? styles.workspaceDesktop : styles.workspaceStack}>
        <section
          style={
            isDesktopSplit
              ? { ...styles.formArea, ...styles.formAreaDesktop }
              : isMobileView
                ? { ...styles.formArea, ...styles.formAreaMobile }
                : styles.formArea
          }
        >
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

        <section style={styles.listArea}>
          <div
            style={
              isMobileView
                ? { ...styles.divider, ...styles.dividerMobile }
                : isDesktopSplit
                  ? { ...styles.divider, ...styles.dividerDesktop }
                  : styles.divider
            }
          >
            <span style={isMobileView ? { ...styles.dividerText, ...styles.dividerTextMobile } : styles.dividerText}>保存したプロンプト一覧</span>
            <button
              type="button"
              onClick={() => setOnlyFavorite((value) => !value)}
              style={
                isMobileView
                  ? (onlyFavorite
                    ? { ...styles.favoriteFilterButtonActive, ...styles.favoriteFilterButtonMobile }
                    : { ...styles.favoriteFilterButton, ...styles.favoriteFilterButtonMobile })
                  : (onlyFavorite
                    ? { ...styles.favoriteFilterButtonActive, marginLeft: "8px" }
                    : { ...styles.favoriteFilterButton, marginLeft: "8px" })
              }
            >
              ❤ お気に入り
            </button>

            <div style={{ flex: 1 }} />

            <div style={styles.sortWrap} data-sort-wrap="">
              <button
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                style={isMobileView ? { ...styles.sortButton, ...styles.sortButtonMobile } : styles.sortButton}
              >
                {isMobileView ? "🔀 並び替え" : `🔀 ${sortOrderLabel}`}
              </button>
              {sortMenuOpen && (
                <div style={styles.sortMenu}>
                  {[
                    { key: "newest", label: "新しい順" },
                    { key: "oldest", label: "古い順" },
                    { key: "favorite", label: "お気に入り優先" },
                    { key: "title", label: "タイトル順" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSortOrder(key);
                        localStorage.setItem(SORT_ORDER_KEY, key);
                        setSortMenuOpen(false);
                      }}
                      style={sortOrder === key ? styles.sortMenuItemActive : styles.sortMenuItem}
                    >
                      {sortOrder === key ? "✅ " : "　"}{label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isMobileView && (
              <div style={styles.colButtons}>
                {colOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setColCount(n);
                      localStorage.setItem(COL_COUNT_KEY, n);
                    }}
                    style={selectedColButton === n ? styles.colButtonActive : styles.colButton}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <main style={{ ...styles.gallery, gridTemplateColumns: `repeat(${displayColCount}, 1fr)` }}>
            {filtered.map((item) => (
              <article key={item.id} style={styles.card}>
                {/* サムネイル */}
                <div style={styles.cardThumb}>
                  {imageMap[item.id] ? (
                    <img src={imageMap[item.id]} alt="" style={styles.cardFullImage} />
                  ) : (
                    <div style={styles.noImageFull}>No Thumbnail</div>
                  )}
                  {item.favorite && (() => {
                    const sz = displayColCount <= 4 ? 80 : displayColCount === 5 ? 66 : 52;
                    const hs = displayColCount <= 4 ? 38 : displayColCount === 5 ? 31 : 24;
                    const hx = sz / 3 - hs / 2;
                    const hy = sz / 3 - hs / 2;
                    return (
                      <svg
                        style={styles.favSvg}
                        width={sz}
                        height={sz}
                        viewBox={`0 0 ${sz} ${sz}`}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polygon
                          points={`0,0 ${sz},0 0,${sz}`}
                          fill="rgba(255,79,163,0.85)"
                        />
                        <path
                          transform={`translate(${hx}, ${hy}) scale(${hs / 24})`}
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                          fill="white"
                        />
                      </svg>
                    );
                  })()}
                </div>

                {/* タイトル・日時 */}
                <div style={styles.cardInfo}>
                  <div style={{ ...styles.cardTitle, fontSize: displayColCount <= 4 ? "12px" : displayColCount === 5 ? "11px" : "10px" }}>{item.title}</div>
                  <div style={{ ...styles.date, fontSize: displayColCount <= 4 ? "10px" : "9px" }}>{item.createdAt}</div>
                </div>

                {/* アクションボタン */}
                <div style={styles.cardActions}>
                  <div style={useDenseCardButtons ? { ...styles.cardActionRow, ...styles.cardActionRowDense } : styles.cardActionRow}>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      style={
                        item.favorite
                          ? (useDenseCardButtons ? { ...styles.cardIconButtonFav, ...styles.cardIconButtonDense } : styles.cardIconButtonFav)
                          : (useDenseCardButtons ? { ...styles.cardIconButtonNormal, ...styles.cardIconButtonDense } : styles.cardIconButtonNormal)
                      }
                      title={item.favorite ? "お気に入り解除" : "お気に入りに追加"}
                    >
                      ❤
                    </button>
                    <button
                      onClick={() => editItem(item)}
                      style={useDenseCardButtons ? { ...styles.cardIconButtonNormal, ...styles.cardIconButtonDense } : styles.cardIconButtonNormal}
                      title="編集"
                    >
                      📝
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      style={useDenseCardButtons ? { ...styles.cardIconButtonDelete, ...styles.cardIconButtonDense } : styles.cardIconButtonDelete}
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={useDenseCardButtons ? { ...styles.cardCopyRow, ...styles.cardCopyRowDense } : styles.cardCopyRow}>
                    <button
                      onClick={() => copyText(item.positive, "Positive Prompt")}
                      style={
                        useDenseCardButtons
                          ? styles.cardCopyButtonMicro
                          : (displayColCount >= 6 ? styles.cardCopyButtonCompact : styles.cardCopyButton)
                      }
                    >
                      {useDenseCardButtons ? "Pos" : "📋 Pos"}
                    </button>
                    <button
                      onClick={() => copyText(item.negative, "Negative Prompt")}
                      style={
                        useDenseCardButtons
                          ? styles.cardCopyButtonMicro
                          : (displayColCount >= 6 ? styles.cardCopyButtonCompact : styles.cardCopyButton)
                      }
                    >
                      {useDenseCardButtons ? "Neg" : "📋 Neg"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </main>
        </section>
      </div>
    </div>
  );
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
  await saveBrowserImage(id, dataUrl);
  if (localFileStorageEnabled) await saveLocalFileImage(id, dataUrl);
}

async function getImage(id) {
  if (localFileStorageEnabled) {
    const localImage = await getLocalFileImage(id);
    if (localImage) return localImage;
  }

  const browserImage = await getBrowserImage(id);
  if (browserImage && localFileStorageEnabled) {
    await saveLocalFileImage(id, browserImage);
  }
  return browserImage;
}

async function deleteImage(id) {
  if (localFileStorageEnabled) await deleteLocalFileImage(id);
  await deleteBrowserImage(id);
}

async function deleteAllImages() {
  if (localFileStorageEnabled) await deleteAllLocalFileImages();
  await deleteAllBrowserImages();
}

async function saveBrowserImage(id, dataUrl) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getBrowserImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    let result = "";
    request.onsuccess = () => {
      result = request.result || "";
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function deleteBrowserImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function deleteAllBrowserImages() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Failed to delete IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB delete was blocked"));
  });
}

function loadBrowserState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { items: sampleItems, hasStoredData: false };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { items: sampleItems, hasStoredData: false };
    const untouchedSample = parsed.length === 1
      && parsed[0]?.id === "sample-1"
      && parsed[0]?.title === sampleItems[0].title
      && parsed[0]?.positive === sampleItems[0].positive
      && parsed[0]?.negative === sampleItems[0].negative;
    return { items: parsed, hasStoredData: !untouchedSample };
  } catch {
    return { items: sampleItems, hasStoredData: false };
  }
}

async function requestLocalStorage(pathname, options = {}) {
  const response = await fetch(`${LOCAL_STORAGE_API}${pathname}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Local storage request failed: ${response.status}`);
  }
  return response.json();
}

function loadLocalFileData() {
  return requestLocalStorage("/data");
}

function saveLocalFileData(data) {
  return requestLocalStorage("/data", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function getLocalFileImage(id) {
  const result = await requestLocalStorage(`/images/${encodeURIComponent(id)}`);
  return result.exists ? result.dataUrl : "";
}

function saveLocalFileImage(id, dataUrl) {
  return requestLocalStorage(`/images/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ dataUrl }),
  });
}

function deleteLocalFileImage(id) {
  return requestLocalStorage(`/images/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function deleteAllLocalFileImages() {
  return requestLocalStorage("/images", {
    method: "DELETE",
  });
}

const styles = {

  storageWarning: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "8px",
    padding: "4px 9px",
    border: "1px solid rgba(255,190,92,0.4)",
    borderRadius: "999px",
    background: "rgba(255,190,92,0.1)",
    color: "#ffd58a",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.2,
    cursor: "help",
  },

  storageWarningError: {
    border: "1px solid rgba(255,100,125,0.48)",
    background: "rgba(255,80,110,0.12)",
    color: "#ff9bb1",
  },

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
  favoriteFilterButtonMobile: {
    height: "36px",
    padding: "0 10px",
    fontSize: "12px",
    borderRadius: "10px",
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
  headerToolsMobile: {
    width: "100%",
    minWidth: 0,
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: "8px",
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
  toolButtonMobile: {
    flex: "1 1 120px",
    minWidth: 0,
  },
  dangerToolButton: {
    border: "1px solid rgba(255,98,126,0.55)",
    background: "rgba(255,80,110,0.12)",
    color: "#ffd6df",
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
    minWidth: "80px",
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
    fontSize: "11px",
    textAlign: "left",
    paddingLeft: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
  pageMobile: {
    padding: "12px",
    overflowX: "clip",
  },
  workspaceStack: {
    display: "block",
    minWidth: 0,
  },
  workspaceDesktop: {
    display: "grid",
    gridTemplateColumns: "clamp(360px, 42vw, 640px) minmax(0, 1fr)",
    gap: "20px",
    alignItems: "start",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "14px",
    position: "sticky",
    top: 0,
    zIndex: 40,
    padding: "8px 0 12px",
    background:
      "radial-gradient(circle at top left, rgba(255,79,163,0.11), transparent 48%), linear-gradient(180deg, rgba(8,9,13,0.93) 0%, rgba(8,9,13,0.86) 72%, rgba(8,9,13,0.62) 100%)",
    backdropFilter: "blur(6px)",
  },
  headerMobile: {
    position: "static",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "10px",
    padding: "8px 0 10px",
    background: "transparent",
    backdropFilter: "none",
  },
  title: { margin: 0, fontSize: "32px", lineHeight: 1.1 },
  titleMobile: { fontSize: "26px" },
  versionBadge: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#a9acb7",
    verticalAlign: "middle",
    marginLeft: "10px",
    letterSpacing: "0.08em",
  },
  brand: { color: "#ff7ab8" },
  subtitle: {
    margin: "10px 0 0 0",
    color: "#d7d9df",
    fontSize: "16px",
    textAlign: "left",
    paddingLeft: "0px",
  },
  subtitleMobile: {
    fontSize: "14px",
    marginTop: "6px",
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
  searchWrapMobile: {
    flex: "1 1 100%",
    minWidth: 0,
    maxWidth: "100%",
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
  confirmSubText: {
    color: "#c4c8d3",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: "-12px 0 18px",
  },
  confirmSubTextStrong: {
    color: "#ff9bb4",
    fontSize: "13px",
    lineHeight: 1.5,
    margin: "-12px 0 18px",
    fontWeight: 700,
  },
  confirmButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  },
  confirmSupportButton: {
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
  confirmProceedButton: {
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: "1px solid rgba(255,172,98,0.45)",
    background: "rgba(255,172,98,0.14)",
    color: "#ffe2c2",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
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
  confirmCloseButton: {
    marginTop: "10px",
    width: "100%",
    padding: "10px 0",
    borderRadius: "12px",
    border: "1px solid rgba(120,128,146,0.45)",
    background: "rgba(120,128,146,0.1)",
    color: "#cfd2dc",
    fontSize: "13px",
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
  formAreaMobile: {
    padding: "14px",
    overflowX: "hidden",
  },
  formAreaDesktop: {
    marginBottom: 0,
    position: "sticky",
    top: "112px",
    maxHeight: "calc(100vh - 126px)",
    overflowY: "auto",
  },
  sectionTitle: { margin: "0 0 14px", fontSize: "17px", textAlign: "left" },
  form: { display: "grid", gap: "14px", width: "100%", minWidth: 0 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    minWidth: 0,
  },
  labelText: {
    display: "block",
    fontWeight: 700,
    fontSize: "12px",
    textAlign: "left",
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    color: "#f3f3f5",
  },
  input: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
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
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    minHeight: "140px",
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
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    minHeight: "110px",
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
    display: "flex",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "14px",
    width: "100%",
    minWidth: 0,
  },
  imageSelectArea: {
    display: "grid",
    gap: "10px",
    flex: "1 1 320px",
    minWidth: 0,
    width: "100%",
  },
  thumbnailPickerWrap: {
    position: "relative",
  },
  fileLabelSelected: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "0",
    border: "1px solid rgba(255,122,184,0.65)",
    borderRadius: "14px",
    background: "rgba(255,122,184,0.08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    cursor: "pointer",
    padding: "12px",
  },
  uploadPreviewImage: {
    width: "100%",
    maxWidth: "420px",
    aspectRatio: "4 / 3",
    height: "auto",
    maxHeight: "220px",
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
    width: "100%",
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
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 190px",
    minWidth: 0,
  },
  saveAsButton: {
    minWidth: "170px",
    width: "170px",
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
    width: "170px",
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
  dividerDesktop: {
    margin: "0 0 18px",
    borderTop: "none",
    paddingTop: 0,
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: "10px",
  },
  dividerMobile: {
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: "8px",
    columnGap: "8px",
    margin: "8px 0 14px",
    paddingTop: "12px",
  },
  listArea: {
    minWidth: 0,
  },
  dividerText: { whiteSpace: "nowrap", color: "#f1f1f4", fontWeight: 700 },
  dividerTextMobile: {
    flex: "1 1 100%",
    fontSize: "18px",
  },
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
    display: "flex",
    flexDirection: "column",
  },
  cardThumb: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderTopLeftRadius: "18px",
    borderTopRightRadius: "18px",
  },
  cardFullImage: {
    width: "100%",
    aspectRatio: "3 / 4",
    objectFit: "cover",
    display: "block",
  },
  noImageFull: {
    aspectRatio: "3 / 4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6f7482",
    fontSize: "14px",
    background: "#1b1e26",
  },
  cardInfo: {
    padding: "8px 10px 4px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minHeight: "56px",
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: "12px",
    lineHeight: 1.3,
    minHeight: "2.6em",
    whiteSpace: "normal",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    color: "#f1f1f4",
  },
  date: { color: "#858a96", fontSize: "10px" },
  cardActions: {
    padding: "6px 8px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    marginTop: "auto",
  },
  cardActionRow: {
    display: "flex",
    gap: "4px",
    minWidth: 0,
  },
  cardActionRowDense: {
    gap: "2px",
  },
  cardCopyRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px",
    minWidth: 0,
  },
  cardCopyRowDense: {
    gap: "2px",
  },
  favSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    zIndex: 2,
  },
  cardIconButtonNormal: {
    flex: 1,
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(25,29,37,0.92)",
    color: "#d4d6df",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconButtonFav: {
    flex: 1,
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(255,122,184,0.6)",
    background: "rgba(255,79,163,0.18)",
    color: "#ff6db8",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconButtonDelete: {
    flex: 1,
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(255,80,110,0.35)",
    background: "rgba(255,80,110,0.1)",
    color: "#ff6f91",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconButtonDense: {
    height: "28px",
    fontSize: "12px",
    lineHeight: 1.2,
    padding: 0,
  },
  cardCopyButton: {
    height: "30px",
    minWidth: 0,
    padding: "0 6px",
    borderRadius: "8px",
    border: "1px solid #343844",
    background: "rgba(15,18,26,0.88)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardCopyButtonMicro: {
    height: "28px",
    minWidth: 0,
    borderRadius: "8px",
    border: "1px solid #343844",
    background: "rgba(15,18,26,0.88)",
    color: "#fff",
    fontSize: "9px",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 2px",
    gap: "1px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.2,
  },
  cardCopyButtonCompact: {
    height: "30px",
    minWidth: 0,
    borderRadius: "8px",
    border: "1px solid #343844",
    background: "rgba(15,18,26,0.88)",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    gap: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  buttons: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" },
  sortWrap: { position: "relative" },
  sortButton: {
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
    font: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    lineHeight: 1,
  },
  sortButtonMobile: {
    height: "36px",
    padding: "0 10px",
    fontSize: "12px",
    borderRadius: "10px",
  },
  sortMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    zIndex: 1000,
    background: "rgba(18,21,27,0.98)",
    border: "1px solid rgba(255,122,184,0.35)",
    borderRadius: "14px",
    padding: "6px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "160px",
  },
  sortMenuItem: {
    background: "transparent",
    border: "none",
    color: "#d4d6df",
    padding: "10px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    font: "inherit",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  sortMenuItemActive: {
    background: "rgba(255,122,184,0.12)",
    border: "none",
    color: "#ffd7ea",
    padding: "10px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    font: "inherit",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  colButtons: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  },
  colButton: {
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "10px",
    background: "rgba(25,29,37,0.92)",
    color: "#d4d6df",
    width: "36px",
    height: "40px",
    boxSizing: "border-box",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    font: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  colButtonActive: {
    border: "1px solid rgba(255,122,184,0.75)",
    borderRadius: "10px",
    background: "rgba(255,79,163,0.22)",
    color: "#ffd7ea",
    width: "36px",
    height: "40px",
    boxSizing: "border-box",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    font: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
};
