import { CardData, Tag } from '../types';

const RESERVED = new Set(['recommended', 'watching', 'tat', 'card']);

export const slugifyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tag';

export const normalizeTagSlug = (slug: string | undefined, fallbackName: string) => {
  const base = slugifyName(slug || fallbackName);
  return RESERVED.has(base) ? `${base}-tag` : base;
};

export const getTagSlug = (tag: Tag) => normalizeTagSlug(tag.slug, tag.name);

export const sectionFromCard = (card: CardData, tags: Tag[]) => {
  const firstTagId = card.tagIds[0];
  if (firstTagId) {
    const tag = tags.find((item) => item.id === firstTagId);
    if (tag) return getTagSlug(tag);
  }
  if (card.isRecommended) return 'recommended';
  if (card.isWatching) return 'watching';
  return 'recommended';
};
