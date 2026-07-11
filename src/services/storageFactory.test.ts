import { afterEach, describe, expect, it, vi } from 'vitest';

const loadStorageFactory = async () => {
  vi.resetModules();
  return import('./storageFactory');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storageFactory', () => {
  it('posts login credentials to the unified API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { storageAdapter } = await loadStorageFactory();
    expect(await storageAdapter.login?.('admin', 'pw', true)).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/storage/login', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('reports public data conflicts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '数据已更新' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { storageAdapter } = await loadStorageFactory();
    const result = await storageAdapter.savePublicData({
      updatedAt: 20,
      settings: { title: 't', iconUrl: '' },
      tags: [],
      cards: []
    }, { expectedUpdatedAt: 10 });

    expect(result).toEqual({ success: false, conflict: true, error: '数据已更新' });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ 'X-Expected-Updated-At': '10' }));
  });

  it('loads the active storage driver', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ driver: 'redis' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    const { fetchStorageDriver, getStorage } = await loadStorageFactory();
    expect(await fetchStorageDriver()).toBe('redis');
    expect(getStorage().type).toBe('redis');
  });

  it('runs media garbage collection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      removed: 2,
      checked: 5,
      pending: 1,
      hasMore: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    const { runCoverGarbageCollectionBatch } = await loadStorageFactory();
    expect(await runCoverGarbageCollectionBatch(80)).toEqual({ success: true, removed: 2, checked: 5, pending: 1, hasMore: true });
  });

  it('reads audit logs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: '1', ts: 1, action: 'run_media_gc', status: 'success' }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    const { getAuditLogs } = await loadStorageFactory();
    const result = await getAuditLogs(10);
    expect(result.success).toBe(true);
    if (result.success) expect(result.items[0].action).toBe('run_media_gc');
  });
});
