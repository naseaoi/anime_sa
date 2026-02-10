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
