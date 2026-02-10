import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateEmbeddedCoverAssets, persistCardCover } from './coverAssetService';
import { CardData } from '../types';
import { getStorage } from './storageFactory';

vi.mock('./storageFactory', () => ({
  getStorage: vi.fn()
}));

const getStorageMock = vi.mocked(getStorage);

const makeCard = (overrides: Partial<CardData>): CardData => ({
  id: overrides.id || '1',
  title: overrides.title || 'title',
  coverUrl: overrides.coverUrl || '',
  coverLocalData: overrides.coverLocalData || '',
  description: overrides.description || '',
  startDate: overrides.startDate || '',
  endDate: overrides.endDate || '',
  rating: overrides.rating || 0,
  tagIds: overrides.tagIds || [],
  isRecommended: overrides.isRecommended || false,
  isWatching: overrides.isWatching || false,
  createdAt: overrides.createdAt || 1,
  updatedAt: overrides.updatedAt || 1
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('coverAssetService', () => {
  it('persistCardCover prefers webp for generated thumb/card variants', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1200;
      naturalHeight = 1800;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const createElementMock = vi.fn((tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toDataURL: vi.fn((mime?: string) => `data:${mime || 'image/png'};base64,AAAA`),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime?: string) => {
          cb(new Blob([new Uint8Array([1, 2, 3])], { type: mime || 'image/png' }));
        })
      };
    });

    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    vi.stubGlobal('document', { createElement: createElementMock });
    vi.stubGlobal('Image', MockImage as any);
    const UrlCtor = URL;
    vi.stubGlobal('URL', Object.assign(UrlCtor, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn()
    }));

    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const inputCard: Partial<CardData> & { id: string } = {
      id: 'card-1',
      coverUrl: '',
      coverLocalData: 'data:image/png;base64,AA=='
    };

    const result = await persistCardCover(inputCard);

    expect(result.coverVariants?.thumb).toContain('/api/sqlite/media?name=');
    expect(result.coverVariants?.card).toContain('/api/sqlite/media?name=');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    const thirdHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;

    expect(firstHeaders['Content-Type']).toBe('image/png');
    expect(secondHeaders['Content-Type']).toBe('image/webp');
    expect(thirdHeaders['Content-Type']).toBe('image/webp');
  });

  it('persistCardCover upgrades existing non-webp variants during backfill', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 2400;
      naturalHeight = 1500;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const createElementMock = vi.fn((tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime?: string) => {
          cb(new Blob([new Uint8Array([3, 4, 5])], { type: mime || 'image/png' }));
        })
      };
    });

    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    vi.stubGlobal('document', { createElement: createElementMock });
    vi.stubGlobal('Image', MockImage as any);
    const UrlCtor = URL;
    vi.stubGlobal('URL', Object.assign(UrlCtor, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn()
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([9, 9, 9]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' }
        })
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await persistCardCover({
      id: 'card-legacy',
      coverUrl: '/api/sqlite/media?name=legacy-original.png',
      coverLocalData: '',
      coverVariants: {
        original: '/api/sqlite/media?name=legacy-original.png',
        thumb: '/api/sqlite/media?name=legacy-thumb.png',
        card: '/api/sqlite/media?name=legacy-card.png'
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    const thirdHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(secondHeaders['Content-Type']).toBe('image/webp');
    expect(thirdHeaders['Content-Type']).toBe('image/webp');
    expect(result.coverVariants?.thumb).toContain('.webp');
    expect(result.coverVariants?.card).toContain('.webp');
  });

  it('persistCardCover backfills cross-origin cover via server proxy', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1800;
      naturalHeight = 1000;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const createElementMock = vi.fn((tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime?: string) => {
          cb(new Blob([new Uint8Array([6, 7, 8])], { type: mime || 'image/jpeg' }));
        })
      };
    });

    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    vi.stubGlobal('document', { createElement: createElementMock });
    vi.stubGlobal('Image', MockImage as any);
    const UrlCtor = URL;
    vi.stubGlobal('URL', Object.assign(UrlCtor, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn()
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([2, 2, 2]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' }
        })
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await persistCardCover({
      id: 'card-remote',
      coverUrl: 'https://cdn.example.com/original.jpg',
      coverLocalData: '',
      coverVariants: {
        original: 'https://cdn.example.com/original.jpg',
        thumb: 'https://cdn.example.com/thumb.jpg',
        card: 'https://cdn.example.com/card.jpg'
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/sqlite/remote-image?url=');
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    const thirdHeaders = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(secondHeaders['Content-Type']).toBe('image/webp');
    expect(thirdHeaders['Content-Type']).toBe('image/webp');
    expect(result.coverVariants?.thumb).toContain('.webp');
    expect(result.coverVariants?.card).toContain('.webp');
  });

  it('persistCardCover uploads embedded image in sqlite mode', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const inputCard: Partial<CardData> & { id: string } = {
      id: 'card-1',
      coverUrl: '',
      coverLocalData: 'data:image/png;base64,AA=='
    };
    const result = await persistCardCover(inputCard);

    expect(result.coverLocalData).toBe('');
    expect(result.coverUrl).toContain('/api/sqlite/media?name=');
    expect(result.coverVariants?.original).toContain('/api/sqlite/media?name=');
    expect(result.coverVariants?.thumb).toContain('/api/sqlite/media?name=');
    expect(result.coverVariants?.card).toContain('/api/sqlite/media?name=');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/sqlite/media?name=');
  });

  it('migrateEmbeddedCoverAssets migrates successful items only', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('write failed', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = makeCard({ id: '1', coverLocalData: 'data:image/png;base64,AA==', coverUrl: '' });
    const second = makeCard({ id: '2', coverLocalData: '', coverUrl: 'https://a/b.png' });
    const third = makeCard({ id: '3', coverLocalData: 'data:image/png;base64,AA==', coverUrl: '' });

    const result = await migrateEmbeddedCoverAssets([first, second, third]);

    expect(result.migrated).toBe(1);
    expect(result.cards[0].coverLocalData).toBe(first.coverLocalData);
    expect(result.cards[2].coverLocalData).toBe('');
    expect(result.cards[2].coverUrl).toContain('/api/sqlite/media?name=');
    expect(result.cards[2].coverVariants?.original).toContain('/api/sqlite/media?name=');
  });
});
