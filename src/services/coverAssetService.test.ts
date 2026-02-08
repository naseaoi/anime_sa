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
  it('persistCardCover uploads embedded image in sqlite mode', async () => {
    getStorageMock.mockReturnValue({ type: 'sqlite' } as any);
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await persistCardCover({
      id: 'card-1',
      coverUrl: '',
      coverLocalData: 'data:image/png;base64,AA=='
    });

    expect(result.coverLocalData).toBe('');
    expect(result.coverUrl).toContain('/api/sqlite/media?name=');
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
  });
});
