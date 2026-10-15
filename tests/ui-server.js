import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { localStoragePlugin } from '../local-storage-plugin.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pam-ui-test-'));
const dataDir = path.join(root, 'data');
await fs.mkdir(dataDir);
await fs.writeFile(path.join(dataDir, 'prompt-assets.json'), JSON.stringify({ version: 2, items: [{ id: 'fixture', title: '検証用データ', positive: 'fixture prompt', negative: '', notes: '', tags: [], hasImage: false, favorite: false }], trash: [], importBackup: null }));
const server = await createServer({ configFile: false, envFile: false,
  root: process.cwd(), cacheDir: path.join(root, 'cache'), plugins: [localStoragePlugin({ dataDir }), react()],
  server: { host: 'localhost', port: 4188, strictPort: true } });
await server.listen();
console.log(`Isolated UI: http://localhost:4188/ ; scratch: ${root}`);
async function stop() {
  await server.close();
  if (root.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('pam-ui-test-')) await fs.rm(root, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
