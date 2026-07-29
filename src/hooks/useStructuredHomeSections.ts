import { useMemo } from 'react';
import type { CardData, Tag } from '../types';

export interface StructuredHomeSections {
  topCards: CardData[];
  watchingCards: CardData[];
  tagSections: { tag: Tag; cards: CardData[] }[];
}

interface Params {
  isStructuredHome: boolean;
  filteredCards: CardData[];
  tags: Tag[];
  sectionCardLimit: number;
}

export const LATEST_WINDOW_DAYS = 14;
const LATEST_WINDOW_MS = LATEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// 结构化首页分区计算：观看中/标签分区收录完整命中集合，"最新收录"只收窗口期新卡与无标签卡
export const useStructuredHomeSections = (params: Params): StructuredHomeSections | null => {
  const { isStructuredHome, filteredCards, tags, sectionCardLimit } = params;

  return useMemo(() => {
    if (!isStructuredHome) return null;

    const windowStart = Date.now() - LATEST_WINDOW_MS;
    const watchingCards: CardData[] = [];
    const topCandidates: CardData[] = [];
    const cardsByTag = new Map<string, CardData[]>();

    tags.forEach((tag) => {
      cardsByTag.set(tag.id, []);
    });

    for (const card of filteredCards) {
      if (card.isWatching) watchingCards.push(card);
      for (const tagId of card.tagIds) {
        cardsByTag.get(tagId)?.push(card);
      }
      // 无标签卡片落不进任何标签分区，不受窗口约束
      if (!card.isWatching && (card.tagIds.length === 0 || card.createdAt >= windowStart)) {
        topCandidates.push(card);
      }
    }

    // 无标签卡片优先；组内固定按收录时间倒序，不跟随顶栏排序
    const topCards = [...topCandidates]
      .sort((a, b) => {
        const aHasTag = a.tagIds.length > 0;
        const bHasTag = b.tagIds.length > 0;
        if (aHasTag !== bHasTag) return aHasTag ? 1 : -1;
        return b.createdAt - a.createdAt;
      })
      .slice(0, sectionCardLimit);

    // 已在上方分区露出的卡沉到标签分区末尾，分区集合本身保持完整
    const shownIds = new Set([
      ...watchingCards.slice(0, sectionCardLimit).map((card) => card.id),
      ...topCards.map((card) => card.id)
    ]);

    const tagSections = tags
      .map((tag) => {
        const cards = cardsByTag.get(tag.id) || [];
        const fresh: CardData[] = [];
        const shown: CardData[] = [];
        for (const card of cards) {
          (shownIds.has(card.id) ? shown : fresh).push(card);
        }
        return { tag, cards: [...fresh, ...shown] };
      })
      .filter((section) => section.cards.length > 0);

    return { topCards, watchingCards, tagSections };
  }, [isStructuredHome, filteredCards, tags, sectionCardLimit]);
};
