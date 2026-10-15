import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { localStoragePlugin } from '../local-storage-plugin.js';
import { createStorageClient, readCache, writeCache } from '../src/storage-client.js';
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pam-storage-test-'));
  const dataDir = path.join(root, 'data');
  const server = await createServer({ configFile: false, envFile: false, root, publicDir: false,
    cacheDir: path.join(root, 'cache'), appType: 'custom', logLevel: 'silent',
    plugins: [localStoragePlugin({ dataDir, launchId: "fixture-launch" })], server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null } });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const request = (url, options) => fetch(base + url, options);
  const client = () => createStorageClient(request);
  const session = await request('/api/local-storage/session', { headers: { 'X-PuniQ-Client': '1' } }).then(r => r.json());
  const headers = { 'X-PuniQ-Client': '1', 'X-PuniQ-Token': session.token, 'Content-Type': 'application/json' };
  const api = (route, options = {}) => request('/api/local-storage' + route, { ...options, headers: { ...headers, ...options.headers } });
  t.after(async () => {
    await server.close();
    assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('pam-storage-test-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, dataDir, api, request, client };
}
const snapshot = title => ({ version: 2, items: [{ id: 'record-1', title }], trash: [], importBackup: null });
test('12 concurrent requests: one commit, 11 conflicts, no 500 or temporary files', async t => {
  const { api, client, dataDir } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('original'));
  const { revision } = await api('/data').then(r => r.json());
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => api('/data', { method: 'POST', headers: { 'If-Match': revision }, body: JSON.stringify(snapshot(String(i))) })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 11);
  assert.ok(JSON.parse(await fs.readFile(path.join(dataDir, 'prompt-assets.json'), 'utf8')).items.length);
  assert.equal((await fs.readdir(dataDir)).some(name => name.endsWith('.tmp') || name === '.write-lock'), false);
});
test('rapid writes stay ordered; stale tab and its later queued writes stop', async t => {
  const { client, api } = await fixture(t);
  const a = client(); await a.load(); await a.save(snapshot('initial'));
  const b = client(); await b.load();
  const imageTab = client(); await imageTab.load();
  await Promise.all(Array.from({ length: 12 }, (_, i) => a.save(snapshot('ordered-' + i))));
  await assert.rejects(imageTab.saveImage('stale-image', 'data:image/jpeg;base64,AA=='), { code: 'CONFLICT' });
  await assert.rejects(b.save(snapshot('stale')), { code: 'CONFLICT' });
  await assert.rejects(b.saveImage('new-image', 'data:image/jpeg;base64,AA=='), { code: 'CONFLICT' });
  assert.equal((await api('/data').then(r => r.json())).data.items[0].title, 'ordered-11');
});
test('reject cross-origin, simple POST, missing token, image deletion and static data', async t => {
  const { api, request, client } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('private'));
  const origin = await api('/data', { headers: { Origin: 'http://localhost:9999' } });
  assert.equal(origin.status, 403); assert.equal(origin.headers.get('access-control-allow-origin'), null);
  assert.equal((await api('/session', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request('/api/local-storage/data')).status, 403);
  assert.equal((await api('/data', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await api('/images', { method: 'DELETE' })).status, 405);
  assert.equal((await request('/data/prompt-assets.json')).status, 403);
});
test('immutable images and list survive reset and protected-backup restore', async t => {
  const { client, api } = await fixture(t);
  const c = client(); await c.load();
  const image = 'data:image/jpeg;base64,AA=='; await c.saveImage('image-old', image);
  const data = snapshot('with image'); Object.assign(data.items[0], { hasImage: true, imageId: 'image-old' });
  await c.save(data);
  const { revision } = await api('/data').then(r => r.json());
  assert.equal((await api('/images/image-old', { method: 'PUT', headers: { 'If-Match': revision }, body: JSON.stringify({ dataUrl: 'data:image/jpeg;base64,BB==' }) })).status, 409);
  await c.save({ items: [], trash: [], importBackup: null });
  const backup = (await c.backups()).backups.find(b => b.protected); assert.ok(backup);
  await c.restore(backup.id);
  assert.equal((await c.load()).data.items[0].title, 'with image');
  assert.equal((await c.readImage('image-old')).dataUrl, image);
});
test('missing image prevents committing an incomplete list', async t => {
  const { client } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('safe'));
  const data = snapshot('missing'); data.items[0].hasImage = true;
  await assert.rejects(c.save(data), { code: 'MISSING_IMAGE' });
  assert.equal((await c.load()).data.items[0].title, 'safe');
});
test('disk replacement failure preserves original and stops queued writes', async t => {
  const { client, dataDir, api } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('original'));
  const rename = fs.rename;
  fs.rename = async (from, to) => {
    if (to === path.join(dataDir, 'prompt-assets.json')) throw Object.assign(new Error('simulated disk full'), { code: 'ENOSPC' });
    return rename(from, to);
  };
  try {
    const results = await Promise.allSettled([c.save(snapshot('failed')), c.save(snapshot('must not run'))]);
    assert.ok(results.every(r => r.status === 'rejected'));
  } finally { fs.rename = rename; }
  assert.equal((await api('/data').then(r => r.json())).data.items[0].title, 'original');
  assert.equal((await fs.readdir(dataDir)).some(n => n.endsWith('.tmp') || n === '.write-lock'), false);
});
test('corrupt data blocks normal writes; explicit recovery preserves damaged original', async t => {
  const { client, dataDir, api } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('good')); await c.save(snapshot('newer'));
  await fs.writeFile(path.join(dataDir, 'prompt-assets.json'), '{damaged');
  const recovery = client(); await assert.rejects(recovery.load(), { code: 'CORRUPT_DATA' });
  const { revision } = await api('/data').then(r => r.json());
  assert.equal((await api('/data', { method: 'POST', headers: { 'If-Match': revision }, body: JSON.stringify(snapshot('bad replacement')) })).status, 503);
  await recovery.restore('previous'); assert.equal((await recovery.load()).data.items[0].title, 'good');
  const name = (await fs.readdir(path.join(dataDir, 'backups'))).find(n => n.startsWith('damaged-'));
  assert.equal(await fs.readFile(path.join(dataDir, 'backups', name), 'utf8'), '{damaged');
});
test('missing main file with existing history does not create new data', async t => {
  const { client, dataDir, api } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('first')); await c.save(snapshot('second'));
  await fs.rm(path.join(dataDir, 'prompt-assets.json'));
  await assert.rejects(client().load(), { code: 'CORRUPT_DATA' });
  assert.equal((await api('/data', { method: 'POST', headers: { 'If-Match': 'missing' }, body: JSON.stringify(snapshot('overwrite')) })).status, 503);
});
test('retain 30 normal generations and never auto-prune destructive-operation backups', async t => {
  const { client } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('protected value'));
  await c.save({ items: [], trash: [] }); await c.save(snapshot('restart'));
  for (let i = 0; i < 34; i++) await c.save(snapshot('generation-' + i));
  const backups = (await c.backups()).backups;
  assert.equal(backups.filter(b => b.id.startsWith('snapshot-')).length, 30);
  const backup = backups.find(b => b.protected); assert.ok(backup);
  await c.restore(backup.id); assert.equal((await c.load()).data.items[0].title, 'protected value');
});
test('another process lock blocks writes and is not removed', async t => {
  const { client, dataDir } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('original'));
  await fs.writeFile(path.join(dataDir, '.write-lock'), 'other process');
  await assert.rejects(c.save(snapshot('blocked')), { code: 'LOCKED' });
  assert.equal(await fs.readFile(path.join(dataDir, '.write-lock'), 'utf8'), 'other process');
});
test('disabled or full browser cache does not stop file persistence', async t => {
  const storage = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('quota'); } };
  assert.equal(readCache(storage, 'key'), null);
  const { client } = await fixture(t); const c = client(); await c.load(); await c.save(snapshot('durable'));
  assert.equal(writeCache(storage, 'key', 'value'), false);
  assert.equal((await c.load()).data.items[0].title, 'durable');
});

test('legacy images keyed by record ID remain readable and recoverable', async t => {
  const { client, dataDir } = await fixture(t);
  await fs.mkdir(path.join(dataDir, 'images'), { recursive: true });
  const image = 'data:image/jpeg;base64,LEGACY';
  await fs.writeFile(path.join(dataDir, 'images', 'record-1.txt'), image);
  const data = snapshot('legacy'); data.items[0].hasImage = true;
  await fs.writeFile(path.join(dataDir, 'prompt-assets.json'), JSON.stringify(data));
  const c = client(); assert.equal((await c.load()).data.items[0].imageId, undefined);
  assert.equal((await c.readImage('record-1')).dataUrl, image);
  await c.save({ items: [], trash: [] }); await c.restore('previous');
  assert.equal((await c.load()).data.items[0].title, 'legacy');
  assert.equal((await c.readImage('record-1')).dataUrl, image);
});

test('first upgrade save preserves the existing previous-generation backup', async t => {
  const { client, dataDir } = await fixture(t);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'prompt-assets.json'), JSON.stringify(snapshot('current')));
  await fs.writeFile(path.join(dataDir, 'prompt-assets.previous.json'), JSON.stringify(snapshot('pre-upgrade backup')));
  const c = client(); await c.load(); await c.save(snapshot('changed'));
  const backup = (await c.backups()).backups.find(b => b.id.startsWith('protected-legacy-'));
  assert.ok(backup); await c.restore(backup.id);
  assert.equal((await c.load()).data.items[0].title, 'pre-upgrade backup');
});


test('health identifies the launched instance without disclosing storage paths or tokens', async t => {
  const { request } = await fixture(t);
  const data = await request('/api/local-storage/health').then(r => r.json());
  assert.deepEqual(data, { app: 'puniq-prompt-asset-manager', ok: true, launchId: 'fixture-launch' });
});

test('invalid record types and duplicate IDs do not replace a valid file', async t => {
  const { client, api } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('original'));
  const { revision } = await api('/data').then(r => r.json());
  const invalid = snapshot('bad'); invalid.items[0].title = { invalid: true };
  const duplicate = snapshot('duplicate'); duplicate.trash = [...duplicate.items];
  for (const data of [invalid, duplicate]) assert.equal((await api('/data', { method: 'POST', headers: { 'If-Match': revision }, body: JSON.stringify(data) })).status, 400);
  assert.equal((await c.load()).data.items[0].title, 'original');
});

test('restoring history from a stale tab cannot overwrite newer work', async t => {
  const { client } = await fixture(t);
  const a = client(); await a.load(); await a.save(snapshot('first')); await a.save(snapshot('second'));
  const stale = client(); await stale.load(); await a.save(snapshot('new work'));
  await assert.rejects(stale.restore('previous'), { code: 'CONFLICT' });
  assert.equal((await a.load()).data.items[0].title, 'new work');
});

test('failure to create a backup prevents replacing the current file', async t => {
  const { client, dataDir } = await fixture(t);
  const c = client(); await c.load(); await c.save(snapshot('original'));
  const open = fs.open;
  fs.open = async (file, ...args) => {
    if (String(file).startsWith(path.join(dataDir, 'backups') + path.sep)) throw Object.assign(new Error('backup disk full'), { code: 'ENOSPC' });
    return open(file, ...args);
  };
  try { await assert.rejects(c.save(snapshot('must not replace'))); }
  finally { fs.open = open; }
  assert.equal((await c.load()).data.items[0].title, 'original');
});

test('lost response after a commit does not retry or send later queued writes', async t => {
  const { client, request } = await fixture(t);
  const control = client(); await control.load(); await control.save(snapshot('original'));
  let posts = 0;
  const c = createStorageClient(async (url, options) => {
    const response = await request(url, options);
    if (url.endsWith('/data') && options?.method === 'POST') { posts++; throw new TypeError('response lost after commit'); }
    return response;
  });
  await c.load();
  const results = await Promise.allSettled([c.save(snapshot('committed without acknowledgement')), c.save(snapshot('must not send'))]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(posts, 1);
  assert.equal((await control.load()).data.items[0].title, 'committed without acknowledgement');
});
