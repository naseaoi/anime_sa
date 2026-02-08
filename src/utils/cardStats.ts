import { CardData } from '../types';

export interface CardStats {
  recommendedCount: number;
  watchingCount: number;
  tagCountMap: Map<string, number>;
}

export const buildCardStats = (cards: CardData[]): CardStats => {
  const tagCountMap = new Map<string, number>();
  let recommendedCount = 0;
  let watchingCount = 0;

  for (const card of cards) {
    if (card.isRecommended) recommendedCount += 1;
    if (card.isWatching) watchingCount += 1;

    for (const tagId of card.tagIds) {
      tagCountMap.set(tagId, (tagCountMap.get(tagId) || 0) + 1);
    }
  }

  return { recommendedCount, watchingCount, tagCountMap };
};
