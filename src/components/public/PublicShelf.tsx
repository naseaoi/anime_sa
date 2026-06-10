import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardData, Tag } from '../../types';
import { PublicCard } from './PublicCard';

interface PublicShelfProps {
  icon: React.ReactNode;
  title: string;
  cards: CardData[];
  limit: number;
  getCardHref: (card: CardData) => string;
  getCardState: () => { from: string };
  onViewMore?: () => void;
  tags: Tag[];
}

const SHELF_CARD_SIZES = '(max-width: 639px) 70vw, (max-width: 1023px) 40vw, 300px';

// 首页横向分区：标题行 + snap 滚动卡片带，桌面端箭头翻页
export const PublicShelf: React.FC<PublicShelfProps> = ({
  icon, title, cards, limit, getCardHref, getCardState, onViewMore, tags
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const visibleCards = cards.slice(0, limit);

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  const scrollByPage = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth - 120, 240), behavior: 'smooth' });
  };

  const showArrows = visibleCards.length > 4;

  return (
    <section className="fade-up home-section-visibility space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="font-display text-xl sm:text-2xl text-[color:var(--text-primary)] truncate">{title}</h3>
          <span className="text-xs font-mono text-[color:var(--text-secondary)] shrink-0">{cards.length}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showArrows && (
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => scrollByPage(-1)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] transition-all"
                aria-label={`${title}：向前翻页`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollByPage(1)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] transition-all"
                aria-label={`${title}：向后翻页`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          {onViewMore && (
            <button
              onClick={onViewMore}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            >
              查看更多
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-proximity mask-linear-fade pb-1.5 -mb-1.5"
      >
        {visibleCards.map((card, index) => (
          <PublicCard
            key={card.id}
            card={card}
            href={getCardHref(card)}
            state={getCardState()}
            tagNameById={tagNameById}
            eager={index < 2}
            sizes={SHELF_CARD_SIZES}
            className="w-[68vw] sm:w-[280px] lg:w-[300px] shrink-0 snap-start"
          />
        ))}
      </div>
    </section>
  );
};
