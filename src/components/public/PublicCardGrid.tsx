import React, { useMemo } from 'react';
import { CardData, Tag } from '../../types';
import { PublicCard } from './PublicCard';
import { CardSkeleton } from './PublicSkeletons';

interface PublicCardGridProps {
  gridKey: string;
  filteredCards: CardData[];
  visibleCount: number;
  getCardHref?: (card: CardData) => string;
  getCardState?: (card: CardData) => unknown;
  trailingSkeletonCount?: number;
  tags?: Tag[];
}

const EAGER_COUNT = 6;

const PublicCardGridInner: React.FC<PublicCardGridProps> = ({
  gridKey,
  filteredCards,
  visibleCount,
  getCardHref,
  getCardState,
  trailingSkeletonCount = 0,
  tags
}) => {
  const resolveHref = (card: CardData) => (getCardHref ? getCardHref(card) : `/card/${card.id}`);
  const resolveState = (card: CardData) => (getCardState ? getCardState(card) : undefined);

  // 分类标签 id→name 映射，渲染期 O(1) 查找
  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    (tags || []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  return (
    <div key={gridKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-min">
      {filteredCards.slice(0, visibleCount).map((card, index) => (
        <PublicCard
          key={card.id}
          card={card}
          href={resolveHref(card)}
          state={resolveState(card)}
          tagNameById={tagNameById}
          eager={index < EAGER_COUNT}
          className="card-fade-in fill-mode-both card-visibility-hint"
        />
      ))}
      {Array.from({ length: trailingSkeletonCount }).map((_, index) => (
        <CardSkeleton key={`trailing-skeleton-${index}`} />
      ))}
    </div>
  );
};

export const PublicCardGrid = React.memo(PublicCardGridInner);
PublicCardGrid.displayName = 'PublicCardGrid';
