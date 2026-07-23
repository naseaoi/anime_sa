import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicData } from '../types';

const getStorageMock = vi.fn();
const persistCardCoverMock = vi.fn();
const migrateEmbeddedCoverAssetsMock = vi.fn();

vi.mock('./storageFactory', () => ({ getStorage: getStorageMock }));
vi.mock('./coverAssetService', () => ({
  persistCardCover: persistCardCoverMock,
  migrateEmbeddedCoverAssets: migrateEmbeddedCoverAssetsMock
}));

const makeData = (): PublicData => ({
  version: 0,
  updatedAt: 10,
  revision: 'rev-1',
  settings: { title: '收藏', iconUrl: '' },
  tags: [],
  cards: []
});

describe('publicDataMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistCardCoverMock.mockImplementation(async (card) => card);
    migrateEmbeddedCoverAssetsMock.mockImplementation(async (cards) => ({ cards, migrated: 0 }));
  });

  it('returns the committed snapshot and server revision', async () => {
    const savePublicData = vi.fn().mockResolvedValue({ state: 'persisted', revision: 'rev-2' });
    getStorageMock.mockReturnValue({ savePublicData });

    const { createCardMutation } = await import('./publicDataMutationService');
    const result = await createCardMutation(makeData(), { title: '新卡片' }, { now: 20 });

    expect(result).toMatchObject({ state: 'persisted', revision: 'rev-2' });
    if (result.state === 'persisted') {
      expect(result.data.revision).toBe('rev-2');
      expect(result.data.cards).toHaveLength(1);
      expect(result.data.updatedAt).toBe(20);
    }
    expect(savePublicData).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: 20 }),
      { expectedRevision: 'rev-1' }
    );
  });

  it('keeps a successful commit when the follow-up refresh fails', async () => {
    const { refreshAfterCommit } = await import('./publicDataMutationService');
    await expect(refreshAfterCommit(async () => { throw new Error('refresh failed'); })).resolves.toBe(false);
  });

  it('preserves workspace migration count in the committed result', async () => {
    const data = makeData();
    migrateEmbeddedCoverAssetsMock.mockResolvedValue({ cards: data.cards, migrated: 2 });
    getStorageMock.mockReturnValue({
      savePublicData: vi.fn().mockResolvedValue({ state: 'persisted', revision: 'rev-3' })
    });

    const { commitWorkspaceMutation } = await import('./publicDataMutationService');
    const result = await commitWorkspaceMutation(data, new Set(), { now: 30 });

    expect(result).toMatchObject({ state: 'persisted', revision: 'rev-3', migrated: 2 });
  });
});
