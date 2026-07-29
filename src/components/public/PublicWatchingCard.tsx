import React from 'react';
import { Link } from '../../router';
import { Play, Star } from 'lucide-react';
import { ImagePreview } from '../Common';
import { getCardCoverSourceSet } from '../../utils/cardCover';
import type { PublicCardProps } from './publicCardProps';

// 正在观看横版卡：封面左置 + 信息落在实体面板上，与竖版海报卡拉开视觉语言
const PublicWatchingCardInner: React.FC<PublicCardProps> = ({
  card, href, state, tagNameById, eager = false, loadImage = true, imageKey, sizes, className = ''
}) => {
  const coverSource = getCardCoverSourceSet(card);
  const tagNames = card.tagIds.map((tid) => tagNameById.get(tid)).filter(Boolean);
  const hasPeriod = Boolean(card.startDate || card.endDate);

  return (
    <Link
      to={href}
      state={state}
      data-viewport-image-key={imageKey}
      className={`group relative z-0 flex h-[92px] items-stretch overflow-hidden rounded-xl border border-sky-300/80 bg-[color:var(--surface)] shadow-[0_0_20px_rgba(56,189,248,0.16)] transition-all duration-500 hover:z-10 hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(56,189,248,0.40)] focus-visible:z-10 focus-visible:shadow-[0_0_32px_rgba(56,189,248,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--bg)] dark:border-sky-400/30 sm:h-[112px] lg:h-[120px] ${className}`}
    >
      <span aria-hidden className="w-1 shrink-0 bg-sky-400/90" />

      <div className="relative h-full aspect-video shrink-0 overflow-hidden">
        <ImagePreview
          src={loadImage ? coverSource.src : ''}
          srcSet={loadImage ? coverSource.srcSet : undefined}
          sizes={sizes || '(max-width: 639px) 170px, 220px'}
          alt={card.title}
          className="w-full h-full transition-transform duration-700 group-hover:scale-105"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          deferred={!loadImage}
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors duration-300 group-hover:bg-black/25">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <Play size={13} className="translate-x-[1px] fill-white" />
          </span>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2 sm:px-3.5 sm:py-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 animate-pulse motion-reduce:animate-none" />
          追看中
        </span>

        <h3 className="font-display text-base leading-tight text-[color:var(--text-primary)] line-clamp-1 sm:text-lg">
          {card.title}
        </h3>

        <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] font-semibold text-[color:var(--text-secondary)]">
          <span className="inline-flex shrink-0 items-center gap-1 text-[color:var(--text-primary)]">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {card.rating.toFixed(1)}
          </span>
          {tagNames.length > 0 && (
            <>
              <span aria-hidden className="shrink-0 opacity-50">·</span>
              <span className="truncate">{tagNames.join(' · ')}</span>
            </>
          )}
        </div>

        {hasPeriod && (
          <p className="truncate font-mono text-[10px] text-[color:var(--text-secondary)]">
            {card.startDate || '未知'} → {card.endDate || '至今'}
          </p>
        )}
      </div>
    </Link>
  );
};

export const PublicWatchingCard = React.memo(PublicWatchingCardInner);
PublicWatchingCard.displayName = 'PublicWatchingCard';
