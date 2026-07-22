import type { CardData } from '../types';

interface CreateCardOptions {
  id: string;
  now: number;
  defaultTitle?: string;
}

export const createCardData = (
  card: Partial<CardData>,
  { id, now, defaultTitle = '' }: CreateCardOptions
): CardData => ({
  id,
  title: card.title || defaultTitle,
  coverUrl: card.coverUrl || '',
  coverVariants: card.coverVariants,
  coverLocalData: card.coverLocalData || '',
  description: card.description || '',
  startDate: card.startDate || '',
  endDate: card.endDate || '',
  rating: card.rating || 0,
  tagIds: [...(card.tagIds || [])],
  isRecommended: !!card.isRecommended,
  isWatching: !!card.isWatching,
  createdAt: now,
  updatedAt: now
});

export const updateCardData = (
  currentCard: CardData,
  updates: Partial<CardData>,
  now: number
): CardData => {
  const nextCard = {
    ...currentCard,
    ...updates,
    id: currentCard.id,
    createdAt: currentCard.createdAt,
    updatedAt: now
  };

  if ('coverUrl' in updates && updates.coverUrl !== currentCard.coverUrl) {
    nextCard.coverVariants = undefined;
  }

  return nextCard;
};
