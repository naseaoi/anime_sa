import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../../router';
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
  visibleImageKeys: ReadonlySet<string>;
}

// 剧场 Hero：桌面端封面 16:9 右置 + 模糊封面铺底 + 信息层垂直居中，窄屏全宽裁切，底部熔接页面背景
export const PublicHero: React.FC<PublicHeroProps> = ({
  heroCards, heroIndex, setHeroIndex, setIsHeroPaused,
  onTouchStart, onTouchMove, onTouchEnd, getCardHref, getCardState, visibleImageKeys
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
      aria-label="精选卡片"
      tabIndex={0}
      style={ambient ? ({ '--ambient': ambient } as React.CSSProperties) : undefined}
      onMouseEnter={() => setIsHeroPaused(true)}
      onMouseLeave={() => setIsHeroPaused(false)}
      onFocus={() => setIsHeroPaused(true)}
      onBlur={() => setIsHeroPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative w-full h-[min(70vw,320px)] min-h-[260px] max-h-[320px] sm:h-[min(54vw,380px)] sm:min-h-[300px] sm:max-h-[380px] lg:h-[calc(52vh+4rem)] lg:min-h-[calc(440px+4rem)] lg:max-h-[744px] overflow-hidden">
        <div aria-hidden className="absolute inset-0 hero-stage" />
        {heroCards.map((card, idx) => {
          const coverSource = getCardCoverSourceSet(card);
          const coverUrl = getCardCoverUrl(card, 'thumb');
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
              {showCover && coverUrl && (
                <div aria-hidden className="absolute inset-0 hidden lg:block overflow-hidden">
                  <img
                    src={coverUrl}
                    alt=""
                    className="w-full h-full object-cover hero-backdrop-img select-none"
                    loading={active ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                  />
                </div>
              )}
              <div className="absolute inset-0 lg:top-16 lg:left-auto lg:right-[var(--page-x)] lg:aspect-video lg:overflow-hidden">
                <ImagePreview
                  src={showCover ? coverSource.src : ''}
                  srcSet={showCover ? coverSource.srcSet : undefined}
                  sizes="(min-width: 1024px) calc(75vw - 2.5rem), 100vw"
                  alt={card.title}
                  className="w-full h-full object-cover select-none hero-cover-edge-mask"
                  loading={active ? 'eager' : 'lazy'}
                  fetchPriority={active ? 'high' : 'low'}
                  decoding="async"
                />
              </div>
              <div className="absolute inset-0 hero-melt pointer-events-none" />

              <div className="absolute inset-x-0 bottom-0 z-20 px-[var(--page-x)] pb-10 sm:pb-12 lg:top-16 lg:bottom-0 lg:right-auto lg:w-[46%] lg:min-w-[24rem] lg:pb-0 lg:flex lg:flex-col lg:justify-center">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent)] font-bold mb-2.5">
                  Featured · 精选推荐
                </p>
                <h2 className="font-display text-3xl sm:text-5xl lg:text-4xl xl:text-5xl leading-tight text-[color:var(--text-primary)] line-clamp-2 max-w-3xl mb-3">
                  {card.title}
                </h2>
                <div className="hidden sm:flex items-center gap-3 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[color:color-mix(in_srgb,var(--surface)_65%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-xs font-semibold text-[color:var(--text-primary)]">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    {card.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-[color:var(--text-secondary)] text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 lg:line-clamp-3 font-medium max-w-xl">
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
              className="lg:hidden absolute left-3 top-[36%] sm:top-1/2 -translate-y-1/2 p-2.5 z-30 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all"
              aria-label="上一张"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex((prev) => (prev + 1) % heroLength); }}
              className="lg:hidden absolute right-3 top-[36%] sm:top-1/2 -translate-y-1/2 p-2.5 z-30 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-primary)] transition-all"
              aria-label="下一张"
            >
              <ChevronRight size={20} />
            </button>

            <div className="hidden lg:block absolute bottom-9 left-[var(--page-x)] right-[var(--page-x)] z-30">
              <div className="relative w-[min(64vw,62rem)] max-w-full">
                <div
                  ref={thumbStripRef}
                  className="hero-thumb-strip flex gap-4 w-full overflow-x-auto no-scrollbar py-2"
                >
                  {heroCards.map((card, idx) => (
                    <button
                      key={card.id}
                      data-viewport-image-key={card.id}
                      onClick={() => setHeroIndex(idx)}
                      className={`w-36 xl:w-40 aspect-video shrink-0 rounded-lg overflow-hidden border transition-all duration-300 ${idx === heroIndex ? 'border-[color:var(--accent)] ring-2 ring-[color:var(--accent-soft)] opacity-100' : 'border-[color:var(--line)] opacity-50 hover:opacity-90'}`}
                      aria-label={`切换到 ${card.title}`}
                    >
                      <ImagePreview
                        src={idx === heroIndex || visibleImageKeys.has(card.id) ? getCardCoverUrl(card, 'thumb') : ''}
                        alt=""
                        className="w-full h-full"
                        loading="lazy"
                        decoding="async"
                        deferred={idx !== heroIndex && !visibleImageKeys.has(card.id)}
                      />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setHeroIndex((prev) => (prev - 1 + heroLength) % heroLength)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_58%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_82%,transparent)] border border-[color:var(--line)] backdrop-blur-md text-[color:var(--text-primary)] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all"
                  aria-label="上一张"
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  onClick={() => setHeroIndex((prev) => (prev + 1) % heroLength)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_58%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface)_82%,transparent)] border border-[color:var(--line)] backdrop-blur-md text-[color:var(--text-primary)] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all"
                  aria-label="下一张"
                >
                  <ChevronRight size={19} />
                </button>
              </div>
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
