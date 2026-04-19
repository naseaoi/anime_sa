import { CardData } from '../types';

export type CardCoverVariant = 'thumb' | 'card' | 'original';

const sanitizeUrl = (value?: string) => {
  const next = String(value || '').trim();
  return next.length > 0 ? next : '';
};

export const normalizeCoverVariants = (card: Partial<CardData>) => {
  const baseCover = sanitizeUrl(card.coverUrl);
  const input = card.coverVariants || {};

  const original = sanitizeUrl(input.original) || baseCover;
  const cardVariant = sanitizeUrl(input.card) || sanitizeUrl(input.thumb) || baseCover || original;
  const thumb = sanitizeUrl(input.thumb) || sanitizeUrl(input.card) || baseCover || original;

  if (!original && !cardVariant && !thumb) {
    return undefined;
  }

  return {
    thumb,
    card: cardVariant,
    original
  };
};

export const getCardCoverUrl = (card: Partial<CardData>, variant: CardCoverVariant = 'card') => {
  const localCover = sanitizeUrl(card.coverLocalData);
  if (localCover) return localCover;

  const normalized = normalizeCoverVariants(card);
  if (!normalized) return '';

  if (variant === 'thumb') {
    return normalized.thumb || normalized.card || normalized.original || '';
  }
  if (variant === 'card') {
    return normalized.card || normalized.thumb || normalized.original || '';
  }
  return normalized.original || normalized.card || normalized.thumb || '';
};

// 宽度描述符需与 buildCoverRenditions 的 maxWidth 保持一致
const COVER_VARIANT_WIDTHS = {
  thumb: 640,
  card: 1280
} as const;

// 为卡片生成 <img> 的 src + srcSet，浏览器按视口与 DPR 自动选档，解决首页封面"过采样"的锐化问题
export const getCardCoverSourceSet = (card: Partial<CardData>): { src: string; srcSet?: string } => {
  const localCover = sanitizeUrl(card.coverLocalData);
  if (localCover) return { src: localCover };

  const normalized = normalizeCoverVariants(card);
  if (!normalized) return { src: '' };

  const entries: string[] = [];
  if (normalized.thumb) entries.push(`${normalized.thumb} ${COVER_VARIANT_WIDTHS.thumb}w`);
  if (normalized.card && normalized.card !== normalized.thumb) {
    entries.push(`${normalized.card} ${COVER_VARIANT_WIDTHS.card}w`);
  }

  const src = normalized.card || normalized.thumb || normalized.original || '';
  return {
    src,
    srcSet: entries.length >= 2 ? entries.join(', ') : undefined
  };
};
