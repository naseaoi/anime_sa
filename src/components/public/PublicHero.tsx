import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { CardData } from '../../types';
import { ImagePreview } from '../Common';
import { getCardCoverSourceSet, getCardCoverUrl } from '../../utils/cardCover';
import { getCoverAmbientColor } from '../../utils/coverAmbientColor';

interface PublicHeroProps {
  heroCards: CardData[];
  heroIndex: number;
  setHeroIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsHeroPaused: React.Dispatch<React.SetStateAction<boolean>>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  getCardHref: (card: CardData) => string;
  getCardState: () => { from: string };
}

// 全宽剧场 Hero：封面轮播 + 取色氛围光 + 底部熔接页面背景
export const PublicHero: React.FC<PublicHeroProps> = ({
  heroCards, heroIndex, setHeroIndex, setIsHeroPaused,
  onTouchStart, onTouchMove, onTouchEnd, getCardHref, getCardState
}) => {
  const [ambient, setAmbient] = useState<string | null>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const heroLength = heroCards.length;
  const currentCard = heroCards[heroIndex];
  const neighborIndexes = new Set<number>([
    heroIndex,
    (heroIndex + 1) % Math.max(heroLength, 1),
    (heroIndex - 1 + Math.max(heroLength, 1)) % Math.max(heroLength, 1)
  ]);

  // 当前缩略图滚动到条带可视中心
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const active = strip.children[heroIndex] as HTMLElement | undefined;
    if (!active) return;
    strip.scrollTo({
      left: active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2,
      behavior: 'smooth'
    });
  }, [heroIndex]);

  useEffect(() => {
    if (!currentCard) return;
    let cancelled = false;
    getCoverAmbientColor(currentCard.id, getCardCoverUrl(currentCard, 'thumb')).then((color) => {
      if (!cancelled && color) setAmbient(color);
    });
    return () => { cancelled = true; };
  }, [currentCard]);

  if (heroLength === 0) return null;

  return (
    <section
      className="group relative w-full isolate touch-pan-y hero-standalone-intro hero-ambient"
      style={ambient ? ({ '--ambient': ambient } as React.CSSProperties) : undefined}
      onMouseEnter={() => setIsHeroPaused(true)}
      onMouseLeave={() => setIsHeroPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative w-full h-[52vh] min-h-[380px] sm:min-h-[440px] max-h-[680px] overflow-hidden">
        {heroCards.map((card, idx) => {
          const coverSource = getCardCoverSourceSet(card);
          const showCover = neighborIndexes.has(idx);
          const active = idx === heroIndex;
          return (
            <Link
              key={card.id}
              to={getCardHref(card)}
              state={getCardState()}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              draggable={false}
              tabIndex={active ? 0 : -1}
              aria-hidden={!active}
            >
              <ImagePreview
                src={showCover ? coverSource.src : ''}
                srcSet={showCover ? coverSource.srcSet : undefined}
                sizes="100vw"
                alt={card.title}
                className="w-full h-full object-cover select-none"
                loading={active ? 'eager' : 'lazy'}
                fetchPriority={active ? 'high' : 'low'}
                decoding="async"
              />
              <div className="absolute inset-0 hero-melt pointer-events-none" />

              <div className="absolute inset-x-0 bottom-0 z-20 px-5 md:px-8 lg:px-10 pb-10 sm:pb-12 lg:pb-14 lg:pr-[21rem]">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent)] font-bold mb-2.5">
                  Featured · 精选推荐
                </p>
                <h2 className="font-display text-3xl sm:text-5xl xl:text-6xl leading-tight text-[color:var(--text-primary)] line-clamp-2 max-w-3xl mb-3">
                  {card.title}
                </h2>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[color:color-mix(in_srgb,var(--surface)_65%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-xs font-semibold text-[color:var(--text-primary)]">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    {card.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 font-medium max-w-xl">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}

        {heroLength > 1 && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex((prev) => (prev - 1 + heroLength) % heroLength); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 z-30 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="上一张"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex((prev) => (prev + 1) % heroLength); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 z-30 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="下一张"
            >
              <ChevronRight size={20} />
            </button>

            <div
              ref={thumbStripRef}
              className="hidden lg:flex absolute bottom-12 right-10 z-30 gap-2 max-w-[17rem] overflow-x-auto no-scrollbar"
            >
              {heroCards.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => setHeroIndex(idx)}
                  className={`w-20 aspect-video shrink-0 rounded-md overflow-hidden border transition-all duration-300 ${idx === heroIndex ? 'border-[color:var(--accent)] ring-2 ring-[color:var(--accent-soft)] opacity-100' : 'border-[color:var(--line)] opacity-50 hover:opacity-90'}`}
                  aria-label={`切换到 ${card.title}`}
                >
                  <img src={getCardCoverUrl(card, 'thumb')} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
                </button>
              ))}
            </div>

            <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 pointer-events-none">
              {heroCards.map((_, idx) => (
                <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === heroIndex ? 'w-8 bg-[color:var(--text-primary)]' : 'w-2 bg-[color:color-mix(in_srgb,var(--text-primary)_40%,transparent)]'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-full h-80" />
    </section>
  );
};
