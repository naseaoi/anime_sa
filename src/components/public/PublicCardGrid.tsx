import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PlayCircle, Star, ThumbsUp } from 'lucide-react';
import { CardData } from '../../types';
import { ImagePreview } from '../Common';
import { getCardCoverUrl } from '../../utils/cardCover';

interface PublicCardGridProps {
  gridKey: string;
  filteredCards: CardData[];
  visibleCount: number;
  showHero: boolean;
  heroCards: CardData[];
  heroIndex: number;
  setHeroIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsHeroPaused: React.Dispatch<React.SetStateAction<boolean>>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  getCardHref?: (card: CardData) => string;
  getCardState?: (card: CardData) => unknown;
  staggerCards?: boolean;
}

const PublicCardGridInner: React.FC<PublicCardGridProps> = ({
  gridKey,
  filteredCards,
  visibleCount,
  showHero,
  heroCards,
  heroIndex,
  setHeroIndex,
  setIsHeroPaused,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  getCardHref,
  getCardState,
  staggerCards = false
}) => {
  const resolveHref = (card: CardData) => (getCardHref ? getCardHref(card) : `/card/${card.id}`);
  const resolveState = (card: CardData) => (getCardState ? getCardState(card) : undefined);
  const heroLength = heroCards.length;
  const heroNeighborIndexes = new Set<number>([
    heroIndex,
    (heroIndex + 1) % Math.max(heroLength, 1),
    (heroIndex - 1 + Math.max(heroLength, 1)) % Math.max(heroLength, 1)
  ]);

  return (
    <div key={gridKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-min">
      {showHero && (
        <div className="group relative sm:col-span-2 sm:row-span-2 aspect-[1.72/1] w-full isolate touch-pan-y hero-standalone-intro">
          <div className="w-full h-full" onMouseEnter={() => setIsHeroPaused(true)} onMouseLeave={() => setIsHeroPaused(false)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="absolute inset-0 rounded-[1.4rem] overflow-hidden shadow-[0_28px_60px_rgba(0,0,0,0.28)] ring-1 ring-white/30 dark:ring-amber-100/20" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
              {heroCards.map((card, idx) => (
                <Link key={card.id} to={resolveHref(card)} state={resolveState(card)} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${idx === heroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} draggable={false}>
                  <ImagePreview
                    src={heroNeighborIndexes.has(idx) ? getCardCoverUrl(card, 'card') : ''}
                    alt={card.title}
                    className="w-full h-full object-cover select-none"
                    loading={idx === heroIndex ? 'eager' : 'lazy'}
                    fetchPriority={idx === heroIndex ? 'high' : 'low'}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/20 pointer-events-none" />
                  <div className="absolute top-0 left-0 bg-amber-500 text-white p-2.5 rounded-br-2xl shadow-lg z-10"><ThumbsUp size={22} /></div>
                  <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5 text-white"><Star size={12} className="text-amber-300 fill-amber-300" /><span className="text-xs font-semibold">{card.rating.toFixed(1)}</span></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 text-white drop-shadow-md z-20">
                    <p className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-white/85 mb-2">Featured Pick</p>
                    <h3 className="font-display text-2xl sm:text-4xl leading-tight line-clamp-2 mb-2">{card.title}</h3>
                    <p className="text-white/85 text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 font-medium">{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
            {heroCards.length > 1 && (
              <>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex((prev) => (prev - 1 + heroCards.length) % heroCards.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full drop-shadow-md"><ChevronLeft size={20} /></button>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex((prev) => (prev + 1) % heroCards.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full drop-shadow-md"><ChevronRight size={20} /></button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 pointer-events-none">{heroCards.map((_, idx) => (<div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === heroIndex ? 'w-8 bg-white' : 'w-2 bg-white/45'}`} />))}</div>
              </>
            )}
          </div>
        </div>
      )}

      {filteredCards.slice(0, visibleCount).map((card, index) => (
        <Link
          key={card.id}
          to={resolveHref(card)}
          state={resolveState(card)}
          className="group cursor-pointer fill-mode-both fade-up card-visibility-hint transition-transform duration-500 hover:scale-[1.02]"
          style={staggerCards ? { animationDelay: `${Math.min(index, 18) * 35 + (showHero ? 120 : 0)}ms` } : undefined}
        >
          <div className={`relative rounded-2xl transition-all duration-500 h-full w-full aspect-video overflow-hidden ${
            card.isWatching
              ? 'border border-sky-300/80 dark:border-sky-400/30 shadow-[0_10px_30px_rgba(56,189,248,0.18)] group-hover:shadow-[0_20px_44px_rgba(56,189,248,0.36)]'
              : card.isRecommended
                ? 'border border-amber-300/90 dark:border-amber-400/35 shadow-[0_12px_32px_rgba(217,140,38,0.24)] group-hover:shadow-[0_20px_44px_rgba(217,140,38,0.38)]'
                : 'border border-[color:var(--line)] bg-black/5 dark:bg-white/5 shadow-sm group-hover:shadow-2xl'
          }`}>
            <div className="w-full h-full rounded-2xl overflow-hidden relative isolate" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
              <ImagePreview
                src={getCardCoverUrl(card, 'thumb')}
                alt={card.title}
                className="w-full h-full transition-transform duration-1000 group-hover:scale-110"
                loading={index < (showHero ? 2 : 6) ? 'eager' : 'lazy'}
                fetchPriority={index < (showHero ? 2 : 6) ? 'high' : 'auto'}
                decoding="async"
              />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_95%_at_0%_100%,rgba(0,0,0,0.80)_0%,rgba(0,0,0,0.54)_35%,rgba(0,0,0,0.16)_64%,rgba(0,0,0,0)_100%)]" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-black/10 via-transparent to-amber-200/10 dark:to-amber-200/5" />

              <div className="absolute top-3 right-3 flex gap-2"><div className="bg-black/55 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5"><Star size={12} className="text-amber-300 fill-amber-300" /><span className="text-xs font-semibold text-white">{card.rating.toFixed(1)}</span></div></div>
              <div className="absolute bottom-0 left-0 right-0 text-white drop-shadow-md flex flex-col justify-end p-4">
                <h3 className="font-display text-xl leading-tight line-clamp-1 origin-bottom-left transition-transform duration-300">{card.title}</h3>
                <p className="md:hidden text-white/85 pt-2 line-clamp-1 font-medium text-[11px]">{card.description}</p>
                <div className="hidden md:grid grid-rows-[0fr] md:group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-400 ease-out">
                  <div className="overflow-hidden">
                    <p className="text-white/85 pt-2 line-clamp-2 font-medium text-[11px]">{card.description}</p>
                  </div>
                </div>
              </div>
            </div>

            {card.isRecommended && (
              <div className="absolute top-0 left-0 bg-amber-500 text-white p-2.5 rounded-br-2xl shadow-lg z-20 pointer-events-none">
                <ThumbsUp size={16} />
              </div>
            )}

            {card.isWatching && !card.isRecommended && (
              <div className="absolute top-0 left-0 bg-sky-500 text-white p-2.5 rounded-br-2xl shadow-lg z-20 pointer-events-none">
                <PlayCircle size={16} />
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

export const PublicCardGrid = React.memo(PublicCardGridInner);
PublicCardGrid.displayName = 'PublicCardGrid';
