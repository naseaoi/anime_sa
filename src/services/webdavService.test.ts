import { afterEach, describe, expect, it, vi } from 'vitest';

const loadService = async () => {
  vi.resetModules();
  return import('./webdavService');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('webdavService data safety', () => {
  it('throws when public data cannot be read', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response('upstream failed', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const { webdav } = await loadService();
    await expect(webdav.getPublicData()).rejects.toThrow('WebDAV 读取失败');
  });

  it('returns defaults only when the file does not exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const { DEFAULT_PUBLIC_DATA, webdav } = await loadService();
    await expect(webdav.getPublicData()).resolves.toEqual(DEFAULT_PUBLIC_DATA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the current ETag for versioned writes', async () => {
    const currentData = {
      updatedAt: 100,
      settings: { title: 't', iconUrl: '' },
      tags: [],
      cards: []
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(currentData), {
        status: 200,
        headers: { ETag: '"version-1"', 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const { webdav } = await loadService();
    const result = await webdav.savePublicData({ ...currentData, updatedAt: 200 }, { expectedUpdatedAt: 100 });

    expect(result).toEqual({ success: true });
    const request = fetchMock.mock.calls[2][1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({ 'If-Match': '"version-1"' }));
  });

  it('uses If-None-Match when creating version zero', async () => {
    const nextData = {
      updatedAt: 100,
      settings: { title: 't', iconUrl: '' },
      tags: [],
      cards: []
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const { webdav } = await loadService();
    const result = await webdav.savePublicData(nextData, { expectedUpdatedAt: 0 });

    expect(result).toEqual({ success: true });
    const request = fetchMock.mock.calls[2][1] as RequestInit;
    expect(request.headers).toEqual(expect.objectContaining({ 'If-None-Match': '*' }));
  });
});
