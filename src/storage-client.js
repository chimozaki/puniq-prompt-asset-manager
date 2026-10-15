// Keep a tab's writes ordered, and stop the queue after any failed write.
export function createStorageClient(fetcher = (...args) => fetch(...args)) {
  let session;
  let revision;
  let stopped;
  let queue = Promise.resolve();
  async function request(route, options = {}) {
    if (!session) session = fetcher('/api/local-storage/session', { cache: 'no-store', headers: { 'X-PuniQ-Client': '1' } }).then(async response => {
      if (!response.ok) throw new Error('保存先へ接続できません。BATから起動し直してください。');
      return (await response.json()).token;
    });
    const response = await fetcher(`/api/local-storage${route}`, {
      ...options, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-PuniQ-Client': '1', 'X-PuniQ-Token': await session, ...(options.headers || {}) },
    });
    const result = await response.json();
    if (result.revision !== undefined && route === '/data' && options.method !== 'POST') revision = result.revision;
    if (!response.ok) throw Object.assign(new Error(result.error || '保存先との通信に失敗しました。'), { status: response.status, code: result.code });
    return result;
  }
  function mutate(route, body) {
    const result = queue.then(async () => {
      if (stopped) throw stopped;
      if (revision === undefined) throw new Error('保存データを読み込む前には保存できません。');
      try {
        const value = await request(route, { method: route.startsWith('/images/') ? 'PUT' : 'POST', headers: { 'If-Match': revision }, body: JSON.stringify(body) });
        if (value.revision !== undefined) revision = value.revision;
        return value;
      } catch (error) { stopped = error; throw error; }
    });
    queue = result.catch(() => {});
    return result;
  }
  return {
    load: () => request('/data'),
    save: data => mutate('/data', data),
    saveImage: (id, dataUrl) => mutate(`/images/${encodeURIComponent(id)}`, { dataUrl }),
    readImage: id => request(`/images/${encodeURIComponent(id)}`),
    backups: () => request('/backups'),
    restore: async id => { await queue; stopped = null; return mutate('/restore', { id }); },
  };
}
export function readCache(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
export function writeCache(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch { return false; }
}
