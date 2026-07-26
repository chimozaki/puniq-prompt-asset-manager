import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PUNIQ_PAM_DATA_DIR || path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "prompt-assets.json");
const PREVIOUS_FILE = path.join(DATA_DIR, "prompt-assets.previous.json");
const TEMP_FILE = path.join(DATA_DIR, "prompt-assets.tmp");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const MAX_DATA_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("request too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isValidData(value) {
  return value
    && typeof value === "object"
    && Array.isArray(value.items)
    && (value.sortOrder === undefined || typeof value.sortOrder === "string")
    && (value.colCount === undefined || Number.isInteger(value.colCount));
}

function imagePathForId(id) {
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(id)) return null;
  return path.join(IMAGES_DIR, `${id}.txt`);
}

async function writeData(data) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const next = `${JSON.stringify(data, null, 2)}\n`;

  let current = null;
  try {
    current = await fs.promises.readFile(DATA_FILE, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (current === next) return;
  if (current !== null) await fs.promises.copyFile(DATA_FILE, PREVIOUS_FILE);
  await fs.promises.writeFile(TEMP_FILE, next, "utf8");
  await fs.promises.rename(TEMP_FILE, DATA_FILE);
}

async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/api/local-storage/health" && req.method === "GET") {
    sendJson(res, 200, { app: "puniq-prompt-asset-manager", ok: true });
    return true;
  }

  if (pathname === "/api/local-storage/data") {
    if (req.method === "GET") {
      try {
        const raw = await fs.promises.readFile(DATA_FILE, "utf8");
        const data = JSON.parse(raw);
        if (!isValidData(data)) throw new Error("invalid data file");
        sendJson(res, 200, { exists: true, data });
      } catch (error) {
        if (error.code === "ENOENT") sendJson(res, 200, { exists: false, data: null });
        else throw error;
      }
      return true;
    }

    if (req.method === "POST") {
      const data = JSON.parse(await readBody(req, MAX_DATA_BYTES));
      if (!isValidData(data)) {
        sendJson(res, 400, { error: "invalid data" });
        return true;
      }
      await writeData(data);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  if (pathname === "/api/local-storage/images" && req.method === "DELETE") {
    await fs.promises.rm(IMAGES_DIR, { recursive: true, force: true });
    sendJson(res, 200, { ok: true });
    return true;
  }

  const imageMatch = pathname.match(/^\/api\/local-storage\/images\/([^/]+)$/);
  if (imageMatch) {
    const id = decodeURIComponent(imageMatch[1]);
    const imagePath = imagePathForId(id);
    if (!imagePath) {
      sendJson(res, 400, { error: "invalid image id" });
      return true;
    }

    if (req.method === "GET") {
      try {
        const dataUrl = await fs.promises.readFile(imagePath, "utf8");
        sendJson(res, 200, { exists: true, dataUrl });
      } catch (error) {
        if (error.code === "ENOENT") sendJson(res, 200, { exists: false, dataUrl: "" });
        else throw error;
      }
      return true;
    }

    if (req.method === "PUT") {
      const value = JSON.parse(await readBody(req, MAX_IMAGE_BYTES));
      if (!value || typeof value.dataUrl !== "string" || !value.dataUrl.startsWith("data:image/")) {
        sendJson(res, 400, { error: "invalid image" });
        return true;
      }
      await fs.promises.mkdir(IMAGES_DIR, { recursive: true });
      const temporaryPath = `${imagePath}.tmp`;
      await fs.promises.writeFile(temporaryPath, value.dataUrl, "utf8");
      await fs.promises.rename(temporaryPath, imagePath);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === "DELETE") {
      await fs.promises.rm(imagePath, { force: true });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  if (pathname.startsWith("/api/local-storage/")) {
    sendJson(res, 404, { error: "not found" });
    return true;
  }

  return false;
}

export function localStoragePlugin() {
  return {
    name: "puniq-local-file-storage",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!await handleApi(req, res)) next();
        } catch (error) {
          console.error("[local storage]", error);
          if (!res.headersSent) {
            sendJson(res, error.statusCode || 500, { error: "local storage error" });
          } else {
            res.end();
          }
        }
      });
    },
  };
}
