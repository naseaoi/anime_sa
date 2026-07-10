import { afterEach, describe, expect, it, vi } from 'vitest';

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
};

const loadStorageFactory = async () => {
  vi.resetModules();
  return import('./storageFactory');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storageFactory session and save flow', () => {
  it('sqliteAdapter.login posts credentials and returns success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { sqliteAdapter } = await loadStorageFactory();
    const result = await sqliteAdapter.login?.('admin', 'pw', true);

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sqlite/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.body).toBe(JSON.stringify({ username: 'admin', password: 'pw', remember: true }));
  });

  it('sqliteAdapter.savePublicData returns response text on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('db write failed', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { sqliteAdapter } = await loadStorageFactory();
    const result = await sqliteAdapter.savePublicData({
      settings: { title: 't', iconUrl: 'i' },
      tags: [],
      cards: []
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('db write failed');
  });

  it('sqliteAdapter.getPublicData throws on server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('db unavailable', { status: 503 })));
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { sqliteAdapter } = await loadStorageFactory();
    await expect(sqliteAdapter.getPublicData()).rejects.toThrow('db unavailable');
  });

  it('sqliteAdapter sends expected version and reports conflicts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: '数据已更新' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { sqliteAdapter } = await loadStorageFactory();
    const result = await sqliteAdapter.savePublicData({
      updatedAt: 20,
      settings: { title: 't', iconUrl: '' },
      tags: [],
      cards: []
    }, { expectedUpdatedAt: 10 });

    expect(result).toEqual({ success: false, conflict: true, error: '数据已更新' });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({ 'X-Expected-Updated-At': '10' }));
  });

  it('updateAdminCredentials returns relogin flag from server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, requireRelogin: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { updateAdminCredentials } = await loadStorageFactory();
    const result = await updateAdminCredentials({ username: 'admin', newPassword: '123456' });

    expect(result).toEqual({ success: true, requireRelogin: true });
  });

  it('syncAdminCredentialsToTarget posts payload to target storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { syncAdminCredentialsToTarget } = await loadStorageFactory();
    const result = await syncAdminCredentialsToTarget('webdav', { username: 'root', password: 'pw' });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sqlite/admin-credentials-sync?target=webdav',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('runCoverGarbageCollection returns removed and checked stats', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, removed: 2, checked: 5, pending: 1, hasMore: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { runCoverGarbageCollection } = await loadStorageFactory();
    const result = await runCoverGarbageCollection('sqlite');

    expect(result).toEqual({ success: true, removed: 2, checked: 5, pending: 1, hasMore: true });
  });

  it('getAuditLogs returns list items', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: '1', ts: 1, action: 'run_media_gc', status: 'success' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { getAuditLogs } = await loadStorageFactory();
    const result = await getAuditLogs(10);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.items[0].action).toBe('run_media_gc');
    }
  });

  it('writeAuditLog posts sync failure details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });

    const { writeAuditLog } = await loadStorageFactory();
    const result = await writeAuditLog({
      action: 'sync_public_data',
      status: 'failed',
      details: 'direction=to_webdav sqliteRefs=264',
      message: '仍有 264 个 SQLite 本地封面引用'
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sqlite/audit-logs',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.body).toBe(JSON.stringify({
      action: 'sync_public_data',
      status: 'failed',
      details: 'direction=to_webdav sqliteRefs=264',
      message: '仍有 264 个 SQLite 本地封面引用'
    }));
  });
});
