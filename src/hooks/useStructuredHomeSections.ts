import { useMemo } from 'react';
import type { CardData, Tag } from '../types';

export interface StructuredHomeSections {
  topCards: CardData[];
  recommendedCards: CardData[];
  watchingCards: CardData[];
  tagSections: { tag: Tag; cards: CardData[] }[];
}

interface Params {
  isStructuredHome: boolean;
  heroCards: CardData[];
  filteredCards: CardData[];
  tags: Tag[];
  sectionCardLimit: number;
}

// 结构化首页分区计算：先剔除轮播、再依次挑选"最新/推荐/观看中/按标签"，保持全局排序
export const useStructuredHomeSections = (params: Params): StructuredHomeSections | null => {
  const { isStructuredHome, heroCards, filteredCards, tags, sectionCardLimit } = params;

  return useMemo(() => {
    if (!isStructuredHome) return null;

    const heroIds = new Set(heroCards.map((card) => card.id));
    const topCardsTarget = sectionCardLimit;

    const nonHeroCards: CardData[] = [];
    const recommendedCards: CardData[] = [];
    const watchingCards: CardData[] = [];
    const cardsByTag = new Map<string, CardData[]>();
    const usedCardIds = new Set<string>();

    tags.forEach((tag) => {
      cardsByTag.set(tag.id, []);
    });

    for (const card of filteredCards) {
      if (!heroIds.has(card.id)) {
        nonHeroCards.push(card);
      }
    }

    // 精选推荐区沿用当前排序，不因轮播抽走卡片而打乱顺序
    for (const card of filteredCards) {
      if (card.isRecommended) {
        recommendedCards.push(card);
        usedCardIds.add(card.id);
      }
    }

    for (const card of nonHeroCards) {
      if (usedCardIds.has(card.id)) continue;
      if (card.isWatching) {
        watchingCards.push(card);
        usedCardIds.add(card.id);
      }
    }

    const topCandidates = nonHeroCards.filter((card) => !usedCardIds.has(card.id));
    // 顶部区：无标签卡片优先占位（避免被分到标签分区后顶部空缺）
    const topCandidatesSorted = [...topCandidates].sort((a, b) => {
      const aHasTag = a.tagIds.length > 0;
      const bHasTag = b.tagIds.length > 0;
      if (aHasTag === bHasTag) return 0;
      return aHasTag ? 1 : -1;
    });
    const topCards = topCandidatesSorted.slice(0, topCardsTarget);
    topCards.forEach((card) => usedCardIds.add(card.id));

    for (const card of nonHeroCards) {
      if (usedCardIds.has(card.id)) continue;
      const matchedTag = tags.find((tag) => card.tagIds.includes(tag.id));
      if (matchedTag) {
        const bucket = cardsByTag.get(matchedTag.id);
        if (bucket) {
          bucket.push(card);
          usedCardIds.add(card.id);
        }
      }
    }

    const tagSections = tags
      .map((tag) => ({ tag, cards: cardsByTag.get(tag.id) || [] }))
      .filter((section) => section.cards.length > 0);

    return { topCards, recommendedCards, watchingCards, tagSections };
  }, [isStructuredHome, heroCards, filteredCards, tags, sectionCardLimit]);
};
