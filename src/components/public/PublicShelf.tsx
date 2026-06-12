import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// 首页横向分区：标题行 + snap 滚动卡片带，桌面端悬停浮现两侧翻页钮
export const PublicShelf: React.FC<PublicShelfProps> = ({
  icon, title, cards, limit, getCardHref, getCardState, onViewMore, tags
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const visibleCards = cards.slice(0, limit);
  const [scrollState, setScrollState] = useState({ canScrollPrev: false, canScrollNext: false });

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      setScrollState({ canScrollPrev: false, canScrollNext: false });
      return;
    }
    const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
    const nextState = {
      canScrollPrev: node.scrollLeft > 2,
      canScrollNext: node.scrollLeft < maxScrollLeft - 2
    };
    setScrollState((prev) => (
      prev.canScrollPrev === nextState.canScrollPrev && prev.canScrollNext === nextState.canScrollNext
        ? prev
        : nextState
    ));
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = scrollerRef.current;
    if (!node) return;

    const frameId = window.requestAnimationFrame(updateScrollState);
    const handleResize = () => updateScrollState();
    let resizeObserver: ResizeObserver | null = null;

    window.addEventListener('resize', handleResize);
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(node);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState, visibleCards.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth - 120, 240), behavior: 'smooth' });
  };

  const showArrows = visibleCards.length > 4 && (scrollState.canScrollPrev || scrollState.canScrollNext);
  const edgeMask = scrollState.canScrollPrev
    ? (scrollState.canScrollNext ? 'mask-shelf-both' : 'mask-shelf-left')
    : (scrollState.canScrollNext ? 'mask-shelf-right' : '');

  return (
    <section className="fade-up home-section-visibility space-y-3.5">
      <div className="relative z-20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="font-display text-xl sm:text-2xl text-[color:var(--text-primary)] truncate">{title}</h3>
          <span className="text-xs font-mono text-[color:var(--text-secondary)] shrink-0">{cards.length}</span>
        </div>
        {onViewMore && (
          <button
            type="button"
            onClick={onViewMore}
            className="relative z-30 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors shrink-0"
          >
            查看更多
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      <div className="relative group/shelf">
        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          className={`shelf-scroller flex gap-4 overflow-x-auto no-scrollbar snap-x snap-proximity py-12 -my-12 ${edgeMask}`}
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
        {showArrows && (
          <>
            {scrollState.canScrollPrev && (
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                className="hidden lg:inline-flex absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2.5 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all opacity-0 group-hover/shelf:opacity-100 focus-visible:opacity-100"
                aria-label={`${title}：向前翻页`}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {scrollState.canScrollNext && (
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2.5 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all opacity-0 group-hover/shelf:opacity-100 focus-visible:opacity-100"
                aria-label={`${title}：向后翻页`}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
};
