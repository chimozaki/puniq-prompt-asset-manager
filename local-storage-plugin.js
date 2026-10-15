import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MAX_DATA_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const revisionOf = raw => raw === null ? 'missing' : createHash('sha256').update(raw).digest('hex');
const validId = id => typeof id === 'string' && /^[A-Za-z0-9._-]{1,200}$/.test(id);
const failure = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code });
function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}
async function readBody(req, limit) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw failure(415, 'JSON形式の要求が必要です。');
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw failure(413, '保存できるサイズを超えています。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw failure(400, 'JSONが不正です。'); }
}
function storedItems(data) {
  return [...data.items, ...(data.trash || []), ...(data.importBackup?.items || []), ...(data.importBackup?.trash || [])];
}
function validateData(data) {
  if (!data || !Array.isArray(data.items)
    || (data.trash !== undefined && !Array.isArray(data.trash))
    || (data.importBackup != null && (!Array.isArray(data.importBackup.items) || !Array.isArray(data.importBackup.trash)))
    || (data.sortOrder !== undefined && typeof data.sortOrder !== 'string')
    || (data.colCount !== undefined && !Number.isInteger(data.colCount))) return false;
  const collections = [[...data.items, ...(data.trash || [])], [...(data.importBackup?.items || []), ...(data.importBackup?.trash || [])]];
  if (collections.some(items => new Set(items.map(item => item?.id)).size !== items.length)) return false;
  return storedItems(data).every(item => item && validId(item.id)
    && (item.imageId === undefined || validId(item.imageId))
    && ['title', 'positive', 'negative', 'notes', 'createdAt', 'deletedAt'].every(key => item[key] === undefined || typeof item[key] === 'string')
    && ['hasImage', 'favorite'].every(key => item[key] === undefined || typeof item[key] === 'boolean')
    && (item.tags === undefined || (Array.isArray(item.tags) && item.tags.every(tag => typeof tag === 'string'))));
}
async function readOptional(file) {
  try { return await fs.promises.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function atomicWrite(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.promises.open(temporary, 'wx');
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(temporary, file);
  } finally {
    if (handle) await handle.close();
    await fs.promises.rm(temporary, { force: true });
  }
}

export function localStoragePlugin({ dataDir = process.env.PUNIQ_PAM_DATA_DIR || path.join(ROOT_DIR, 'data'), launchId = process.env.PUNIQ_PAM_LAUNCH_ID || null } = {}) {
  const directory = path.resolve(dataDir);
  const dataFile = path.join(directory, 'prompt-assets.json');
  const previousFile = path.join(directory, 'prompt-assets.previous.json');
  const imagesDir = path.join(directory, 'images');
  const backupsDir = path.join(directory, 'backups');
  const lockFile = path.join(directory, '.write-lock');
  const token = randomUUID();
  let queue = Promise.resolve();
  async function checkDirectories() {
    for (const dir of [directory, imagesDir, backupsDir]) {
      try {
        const stat = await fs.promises.lstat(dir);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw failure(503, '保存フォルダが通常のフォルダではありません。');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  function mutate(operation) {
    const result = queue.then(async () => {
      await checkDirectories();
      await fs.promises.mkdir(directory, { recursive: true });
      let lock;
      try { lock = await fs.promises.open(lockFile, 'wx'); }
      catch (error) {
        if (error.code === 'EEXIST') throw failure(423, '保存先が使用中です。書き込みを停止しました。', 'LOCKED');
        throw error;
      }
      try { return await operation(); }
      finally { await lock.close(); await fs.promises.rm(lockFile, { force: true }); }
    });
    queue = result.catch(() => {});
    return result;
  }
  async function listBackups() {
    let names;
    try { names = await fs.promises.readdir(backupsDir); }
    catch (error) { if (error.code === 'ENOENT') names = []; else throw error; }
    const backups = [];
    for (const id of names.filter(name => /^(snapshot|protected)-[\w-]+\.json$/.test(name)).sort().reverse()) {
      try {
        const data = JSON.parse(await fs.promises.readFile(path.join(backupsDir, id), 'utf8'));
        if (validateData(data)) backups.push({ id, createdAt: (await fs.promises.stat(path.join(backupsDir, id))).mtime.toISOString(), count: data.items.length, protected: id.startsWith('protected-') });
      } catch { /* Never restore a damaged snapshot. */ }
    }
    const previous = await readOptional(previousFile);
    if (previous !== null) {
      try {
        const data = JSON.parse(previous);
        if (validateData(data)) backups.unshift({ id: 'previous', createdAt: (await fs.promises.stat(previousFile)).mtime.toISOString(), count: data.items.length, protected: false });
      } catch { /* Keep damaged originals untouched. */ }
    }
    return backups;
  }
  function checkRevision(req, raw) {
    if (req.headers['if-match'] !== revisionOf(raw)) throw failure(409, '別の画面で更新されています。古い内容での上書きを防ぐため保存を停止しました。', 'CONFLICT');
  }
  async function writeData(req, data, { restore = false } = {}) {
    const current = await readOptional(dataFile);
    checkRevision(req, current);
    if (current === null && !restore && (await listBackups()).length > 0) {
      throw failure(503, '保存ファイルが見つかりません。履歴を確認するまで新規保存を停止します。', 'CORRUPT_DATA');
    }
    const next = `${JSON.stringify(data, null, 2)}\n`;
    if (Buffer.byteLength(next) > MAX_DATA_BYTES) throw failure(413, '保存データが5MiBを超えています。');
    if (current === next) return revisionOf(current);
    let oldData;
    try { oldData = current === null ? null : JSON.parse(current); } catch { /* Explicit recovery only. */ }
    if (current !== null && !validateData(oldData) && !restore) throw failure(503, '保存ファイルが破損しています。保存履歴から復元してください。', 'CORRUPT_DATA');
    for (const item of storedItems(data)) {
      if (item.hasImage) {
        const image = await readOptional(path.join(imagesDir, `${item.imageId || item.id}.txt`));
        if (!image?.startsWith('data:image/')) throw failure(422, '参照する画像が見つかりません。元のデータを保持しました。', 'MISSING_IMAGE');
      }
    }
    await fs.promises.mkdir(backupsDir, { recursive: true });
    // Preserve the pre-upgrade one-generation backup before replacing it.
    if ((await fs.promises.readdir(backupsDir)).length === 0) {
      const legacy = await readOptional(previousFile);
      if (legacy !== null && legacy !== current) {
        let data;
        try { data = JSON.parse(legacy); } catch { /* Do not treat damaged data as a restorable snapshot. */ }
        if (validateData(data)) await atomicWrite(path.join(backupsDir, `protected-legacy-${revisionOf(legacy)}.json`), legacy);
      }
    }
    if (current !== null) {
      const nextIds = new Set(storedItems(data).map(item => item.id));
      const destructive = restore || (validateData(oldData) && storedItems(oldData).some(item => !nextIds.has(item.id)));
      const prefix = !validateData(oldData) ? 'damaged' : destructive ? 'protected' : 'snapshot';
      await atomicWrite(path.join(backupsDir, `${prefix}-${Date.now()}-${randomUUID()}.json`), current);
      if (validateData(oldData)) await atomicWrite(previousFile, current);
    }
    await atomicWrite(dataFile, next);
    // Failure to prune history must not report an already committed save as failed.
    try {
      const names = (await fs.promises.readdir(backupsDir)).filter(name => /^snapshot-[\w-]+\.json$/.test(name)).sort().reverse();
      for (const name of names.slice(30)) await fs.promises.rm(path.join(backupsDir, name));
    } catch (error) { console.warn('[local storage] backup cleanup', error.message); }
    return revisionOf(next);
  }
  async function handleApi(req, res, pathname) {
    if (pathname === '/api/local-storage/health' && req.method === 'GET') {
      sendJson(res, 200, { app: 'puniq-prompt-asset-manager', ok: true, launchId }); return;
    }
    const expected = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(expected).hostname)
      || (req.headers.origin && req.headers.origin !== expected)
      || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')
      || req.headers['x-puniq-client'] !== '1') throw failure(403, 'この送信元からのアクセスは許可されていません。');
    if (pathname === '/api/local-storage/session' && req.method === 'GET') { sendJson(res, 200, { token }); return; }
    if (req.headers['x-puniq-token'] !== token) throw failure(403, '接続を確認できません。未保存内容を書き出してから画面を開き直してください。');
    await checkDirectories();
    if (pathname === '/api/local-storage/data' && req.method === 'GET') {
      const raw = await readOptional(dataFile);
      let data;
      try { data = raw === null ? null : JSON.parse(raw); } catch { /* Preserve original. */ }
      if ((raw !== null && !validateData(data)) || (raw === null && (await listBackups()).length > 0)) {
        sendJson(res, 503, { error: '保存データを正常に読み込めません。自動上書きを停止しました。保存履歴を確認してください。', code: 'CORRUPT_DATA', revision: revisionOf(raw) }); return;
      }
      sendJson(res, 200, { exists: raw !== null, data, revision: revisionOf(raw) }); return;
    }
    if (pathname === '/api/local-storage/data' && req.method === 'POST') {
      const data = await readBody(req, MAX_DATA_BYTES);
      if (!validateData(data)) throw failure(400, '保存データの形式が不正です。');
      sendJson(res, 200, { ok: true, revision: await mutate(() => writeData(req, data)) }); return;
    }
    if (pathname === '/api/local-storage/backups' && req.method === 'GET') { sendJson(res, 200, { backups: await listBackups() }); return; }
    if (pathname === '/api/local-storage/restore' && req.method === 'POST') {
      const { id } = await readBody(req, 1024);
      if (id !== 'previous' && (typeof id !== 'string' || !/^(snapshot|protected)-[\w-]+\.json$/.test(id))) throw failure(400, '保存履歴の指定が不正です。');
      const revision = await mutate(async () => {
        const raw = await readOptional(id === 'previous' ? previousFile : path.join(backupsDir, id));
        let data;
        try { data = JSON.parse(raw); } catch { /* Validate below. */ }
        if (!validateData(data)) throw failure(422, 'この保存履歴からは復元できません。');
        return writeData(req, data, { restore: true });
      });
      sendJson(res, 200, { ok: true, revision }); return;
    }
    const match = pathname.match(/^\/api\/local-storage\/images\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (!validId(id)) throw failure(400, '画像IDが不正です。');
      const imageFile = path.join(imagesDir, `${id}.txt`);
      if (req.method === 'GET') {
        const dataUrl = await readOptional(imageFile);
        sendJson(res, 200, { exists: dataUrl !== null, dataUrl: dataUrl || '' }); return;
      }
      if (req.method === 'PUT') {
        const value = await readBody(req, MAX_IMAGE_BYTES);
        if (typeof value?.dataUrl !== 'string' || !value.dataUrl.startsWith('data:image/')) throw failure(400, '画像形式が不正です。');
        await mutate(async () => {
          checkRevision(req, await readOptional(dataFile));
          const old = await readOptional(imageFile);
          if (old !== null && old !== value.dataUrl) throw failure(409, '既存画像の上書きを拒否しました。', 'CONFLICT');
          if (old === null) { await fs.promises.mkdir(imagesDir, { recursive: true }); await atomicWrite(imageFile, value.dataUrl); }
        });
        sendJson(res, 200, { ok: true }); return;
      }
    }
    // Keep immutable thumbnails for recovery. There is no physical-delete API.
    sendJson(res, 405, { error: 'この操作は許可されていません。' });
  }
  return {
    name: 'puniq-local-file-storage',
    config() {
      return { server: { cors: false, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', `${directory.replaceAll('\\', '/')}/**`, '**/.npmrc', '**/*.tmp', '**/.write-lock'] } } };
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const pathname = new URL(req.url, 'http://localhost').pathname;
          if (!pathname.startsWith('/api/local-storage/')) return next();
          await handleApi(req, res, pathname);
        } catch (error) {
          console.error('[local storage]', error.message);
          if (!res.headersSent) sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : '保存処理に失敗しました。書き込みを停止しました。', code: error.code });
          else res.end();
        }
      });
    },
  };
}
