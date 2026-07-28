import React from 'react';
import { Link } from '../../router';
import { PlayCircle, Star, ThumbsUp } from 'lucide-react';
import type { CardData } from '../../types';
import { ImagePreview } from '../Common';
import { getCardCoverSourceSet } from '../../utils/cardCover';

// 卡片白色文字在亮/暗封面上的可读性增强：纯文字阴影方案
// 双层均匀辐射：2px 紧贴硬阴影（提供对比） + 6px 远距软阴影（提供柔和氛围光）
// 总外扩 ≤6px，配合简介 <p> 的 py-1.5 留出 6px+line-box 余量，规避 overflow-hidden 截断
const COVER_TEXT_SHADOW = '[text-shadow:0_0_2px_rgba(0,0,0,1),0_0_6px_rgba(0,0,0,0.65)]';

interface PublicCardProps {
  card: CardData;
  href: string;
  state?: unknown;
  tagNameById: Map<string, string>;
  eager?: boolean;
  sizes?: string;
  className?: string;
}

// 前台通用卡片：网格与 shelf 共用，hover 发光按推荐/在看/普通三态语义色
const PublicCardInner: React.FC<PublicCardProps> = ({
  card, href, state, tagNameById, eager = false, sizes, className = ''
}) => {
  const coverSource = getCardCoverSourceSet(card);

  const frameTone = card.isRecommended
    ? 'border-amber-300/90 dark:border-amber-400/35'
    : card.isWatching
      ? 'border-sky-300/80 dark:border-sky-400/30'
      : 'border-[color:var(--line)]';

  const glowTone = card.isRecommended
    ? 'shadow-[0_0_20px_rgba(217,140,38,0.18)] hover:shadow-[0_0_32px_rgba(217,140,38,0.42)] focus-visible:shadow-[0_0_32px_rgba(217,140,38,0.42)]'
    : card.isWatching
      ? 'shadow-[0_0_20px_rgba(56,189,248,0.16)] hover:shadow-[0_0_32px_rgba(56,189,248,0.40)] focus-visible:shadow-[0_0_32px_rgba(56,189,248,0.40)]'
      : 'shadow-[0_0_16px_rgba(15,23,42,0.08)] hover:shadow-[0_0_30px_rgba(199,140,43,0.24)] focus-visible:shadow-[0_0_30px_rgba(199,140,43,0.24)] dark:shadow-[0_0_16px_rgba(0,0,0,0.28)] dark:hover:shadow-[0_0_30px_rgba(225,180,101,0.22)] dark:focus-visible:shadow-[0_0_30px_rgba(225,180,101,0.22)]';

  return (
    <Link
      to={href}
      state={state}
      className={`group relative z-0 block cursor-pointer rounded-xl transition-all duration-500 hover:z-10 hover:scale-[1.02] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--bg)] ${glowTone} ${className}`}
    >
      <div className={`relative rounded-xl transition-all duration-500 w-full aspect-video overflow-hidden border bg-[color:var(--surface)] ${frameTone}`}>
        {/* mask 子层：仅包裹图片 + hover 蒙层。文字层不进入此容器，
            规避 webkit-mask 边缘渐隐把贴近左/底的文字阴影衰减成"截断" */}
        <div className="absolute inset-0 rounded-xl overflow-hidden isolate" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
          <ImagePreview
            src={coverSource.src}
            srcSet={coverSource.srcSet}
            sizes={sizes || '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, 20vw'}
            alt={card.title}
            className="w-full h-full transition-transform duration-1000 group-hover:scale-110"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* 文字层在 mask 之外，仅受外层 overflow-hidden 直角裁切，阴影完整保留 */}
        <div className="absolute bottom-0 left-0 right-0 text-white flex flex-col justify-end pt-4 pr-4 pb-3 pl-3 md:group-hover:pb-1.5 md:group-focus:pb-1.5 md:group-focus-visible:pb-1.5 transition-[padding] duration-[400ms] ease-out z-10">
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/40 border border-white/15 backdrop-blur-sm text-[10px] font-semibold leading-none flex-shrink-0">
              <Star size={10} className="text-amber-300 fill-amber-300" />
              {card.rating.toFixed(1)}
            </span>
            {card.tagIds.map((tid) => {
              const name = tagNameById.get(tid);
              if (!name) return null;
              return (
                <span key={tid} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/40 border border-white/15 backdrop-blur-sm text-[10px] font-semibold leading-none flex-shrink-0">
                  {name}
                </span>
              );
            })}
          </div>
          {/* -mx-2 px-2 自抵消左右 padding：阴影向左右扩散 6px 留在 px-2 内部，不被 line-clamp 自身的 overflow:hidden 切 */}
          <h3 className={`mt-1 -mx-2 px-2 font-display text-xl leading-tight line-clamp-1 origin-bottom-left transition-transform duration-300 ${COVER_TEXT_SHADOW}`}>{card.title}</h3>
          {/* 简介默认折叠（grid-rows 0fr），仅桌面端 hover 展开为单行
              grid 容器 -mx-2 让 inner div 向外扩 8px，配合 <p> 的 px-2 抵消位置；
              truncate 替代 line-clamp-1 规避 webkit-box+padding 的 1.5 行渲染 bug；
              py-1.5 给阴影留上下空间 */}
          <div className="hidden md:grid grid-rows-[0fr] md:group-hover:grid-rows-[1fr] md:group-focus:grid-rows-[1fr] md:group-focus-visible:grid-rows-[1fr] -mx-2 transition-[grid-template-rows] duration-[400ms] ease-out">
            <div className="overflow-hidden">
              <p className={`text-white px-2 py-1.5 truncate font-medium text-[11px] ${COVER_TEXT_SHADOW}`}>{card.description}</p>
            </div>
          </div>
        </div>

        {card.isRecommended && (
          <div className="absolute top-0 left-0 bg-amber-500 text-white p-2 rounded-br-xl shadow-lg z-20 pointer-events-none">
            <ThumbsUp size={14} />
          </div>
        )}

        {card.isWatching && !card.isRecommended && (
          <div className="absolute top-0 left-0 bg-sky-500 text-white p-2 rounded-br-xl shadow-lg z-20 pointer-events-none">
            <PlayCircle size={14} />
          </div>
        )}
      </div>
    </Link>
  );
};

export const PublicCard = React.memo(PublicCardInner);
PublicCard.displayName = 'PublicCard';
