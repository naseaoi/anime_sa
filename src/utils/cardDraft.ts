import type { CardData } from '../types';

const CARD_DRAFT_VERSION = 1;
const CARD_DRAFT_PREFIX = 'tat_card_draft:';

export interface CardDraftData {
  title: string;
  coverUrl: string;
  description: string;
  startDate: string;
  endDate: string;
  rating: number;
  tagIds: string[];
  isRecommended: boolean;
  isWatching: boolean;
}

export interface CardDraft {
  savedAt: number;
  card: CardDraftData;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface StoredCardDraft extends CardDraft {
  version: number;
  cardKey: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isBoundedString = (value: unknown, maxLength: number): value is string => (
  typeof value === 'string' && value.length <= maxLength
);

const parseDraftCard = (value: unknown): CardDraftData | null => {
  if (!isRecord(value)) return null;
  if (!isBoundedString(value.title, 10_000)) return null;
  if (!isBoundedString(value.coverUrl, 100_000)) return null;
  if (!isBoundedString(value.description, 2_000_000)) return null;
  if (!isBoundedString(value.startDate, 32)) return null;
  if (!isBoundedString(value.endDate, 32)) return null;
  if (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 5) return null;
  if (!Array.isArray(value.tagIds) || value.tagIds.length > 100) return null;
  if (!value.tagIds.every((tagId) => isBoundedString(tagId, 256))) return null;
  if (typeof value.isRecommended !== 'boolean' || typeof value.isWatching !== 'boolean') return null;

  return {
    title: value.title,
    coverUrl: value.coverUrl,
    description: value.description,
    startDate: value.startDate,
    endDate: value.endDate,
    rating: value.rating,
    tagIds: [...value.tagIds],
    isRecommended: value.isRecommended,
    isWatching: value.isWatching
  };
};

export const getCardDraftKey = (card: Partial<CardData>) => (
  `${CARD_DRAFT_PREFIX}${card.id ? `edit:${encodeURIComponent(card.id)}` : 'new'}`
);

export const getCardDraftData = (card: Partial<CardData>): CardDraftData => ({
  title: card.title || '',
  coverUrl: card.coverUrl || '',
  description: card.description || '',
  startDate: card.startDate || '',
  endDate: card.endDate || '',
  rating: card.rating || 0,
  tagIds: [...(card.tagIds || [])],
  isRecommended: !!card.isRecommended,
  isWatching: !!card.isWatching
});

export const hasCardDraftChanges = (card: Partial<CardData>, initialCard: Partial<CardData>) => (
  JSON.stringify(getCardDraftData(card)) !== JSON.stringify(getCardDraftData(initialCard))
);

export const loadCardDraft = (storage: DraftStorage, initialCard: Partial<CardData>): CardDraft | null => {
  const storageKey = getCardDraftKey(initialCard);

  try {
    const rawDraft = storage.getItem(storageKey);
    if (!rawDraft) return null;

    const value: unknown = JSON.parse(rawDraft);
    if (!isRecord(value)) throw new Error('Invalid card draft');
    if (value.version !== CARD_DRAFT_VERSION || value.cardKey !== storageKey) throw new Error('Invalid card draft');
    if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || value.savedAt <= 0) throw new Error('Invalid card draft');

    const card = parseDraftCard(value.card);
    if (!card || !hasCardDraftChanges(card, initialCard)) throw new Error('Invalid card draft');

    return { savedAt: value.savedAt, card };
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      return null;
    }
    return null;
  }
};

export const saveCardDraft = (
  storage: DraftStorage,
  initialCard: Partial<CardData>,
  card: Partial<CardData>,
  savedAt = Date.now()
) => {
  const storageKey = getCardDraftKey(initialCard);

  try {
    if (!hasCardDraftChanges(card, initialCard)) {
      storage.removeItem(storageKey);
      return false;
    }

    const draft: StoredCardDraft = {
      version: CARD_DRAFT_VERSION,
      cardKey: storageKey,
      savedAt,
      card: getCardDraftData(card)
    };
    storage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const clearCardDraft = (storage: DraftStorage, card: Partial<CardData>) => {
  try {
    storage.removeItem(getCardDraftKey(card));
  } catch {
    return;
  }
};
