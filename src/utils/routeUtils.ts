import { CardData, Tag } from '../types';

const RESERVED = new Set(['recommended', 'watching', 'tat', 'card']);

export const slugifyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

// 存量数据中自动生成的退化值 'tag' 视为无效，回退按名称重算
export const normalizeTagSlug = (slug: string | undefined, fallbackName: string) => {
  const fromSlug = slug ? slugifyName(slug) : '';
  const base = (fromSlug && fromSlug !== 'tag' ? fromSlug : slugifyName(fallbackName)) || 'tag';
  return RESERVED.has(base) ? `${base}-tag` : base;
};

export const getTagSlug = (tag: Tag) => {
  const base = normalizeTagSlug(tag.slug, tag.name);
  return base === 'tag' ? `tag-${tag.id}` : base;
};

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
