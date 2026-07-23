import type { CardData, PublicData } from '../types';
import { createCardData, updateCardData } from '../domain/card';
import type { PersistenceResult } from '../domain/persistence';
import { getStorage } from './storageFactory';
import { migrateEmbeddedCoverAssets, persistCardCover } from './coverAssetService';
import { errorMessage } from './apiClient';

export type CommittedPublicDataResult =
  | ({ state: 'persisted'; revision?: string; data: PublicData; migrated?: number })
  | Extract<PersistenceResult, { state: 'conflict' | 'failed' }>;

interface MutationOptions {
  now?: number;
}

const failedMutationResult = (error: string): Extract<CommittedPublicDataResult, { state: 'failed' }> => ({
  state: 'failed',
  error
});

const commitPreparedData = async (
  data: PublicData,
  { now = Date.now() }: MutationOptions = {}
): Promise<CommittedPublicDataResult> => {
  const dataToSave = { ...data, updatedAt: now };
  try {
    const result = await getStorage().savePublicData(dataToSave, { expectedRevision: data.revision });
    if (result.state !== 'persisted') return result;

    const revision = result.revision || dataToSave.revision;
    return {
      state: 'persisted',
      revision,
      data: { ...dataToSave, revision }
    };
  } catch (error: unknown) {
    return failedMutationResult(errorMessage(error, '数据保存失败'));
  }
};

export const createCardMutation = async (
  data: PublicData,
  cardData: Partial<CardData>,
  { now = Date.now() }: MutationOptions = {}
): Promise<CommittedPublicDataResult> => {
  try {
    const draftCard = createCardData(cardData, {
      id: now.toString(),
      now,
      defaultTitle: 'Untitled'
    });
    const newCard = await persistCardCover(draftCard);
    return commitPreparedData({ ...data, cards: [...data.cards, newCard] }, { now });
  } catch (error: unknown) {
    return failedMutationResult(errorMessage(error, '封面处理失败'));
  }
};

export const updateCardMutation = async (
  data: PublicData,
  card: CardData,
  updates: Partial<CardData>,
  { now = Date.now() }: MutationOptions = {}
): Promise<CommittedPublicDataResult> => {
  try {
    const nextCard = await persistCardCover(updateCardData(card, updates, now));
    const cards = data.cards.map((item) => item.id === card.id ? nextCard : item);
    return commitPreparedData({ ...data, cards }, { now });
  } catch (error: unknown) {
    return failedMutationResult(errorMessage(error, '封面处理失败'));
  }
};

export const commitWorkspaceMutation = async (
  data: PublicData,
  dirtyCardIds: ReadonlySet<string>,
  options: MutationOptions = {}
): Promise<CommittedPublicDataResult> => {
  try {
    const migrated = await migrateEmbeddedCoverAssets(data.cards);
    const preparedCards: CardData[] = [];
    for (const card of migrated.cards) {
      preparedCards.push(dirtyCardIds.has(card.id) ? await persistCardCover(card) : card);
    }

    const result = await commitPreparedData({ ...data, cards: preparedCards }, options);
    return result.state === 'persisted' ? { ...result, migrated: migrated.migrated } : result;
  } catch (error: unknown) {
    return failedMutationResult(errorMessage(error, '封面处理失败'));
  }
};

export const refreshAfterCommit = async (refreshData?: () => Promise<void>) => {
  if (!refreshData) return true;
  try {
    await refreshData();
    return true;
  } catch {
    return false;
  }
};
