import { CardData, Tag } from '../types';
import { getTagSlug } from '../../shared/tagSlug.js';

export { getTagSlug, normalizeTagSlug, slugifyName } from '../../shared/tagSlug.js';

export const resolveSectionTag = (section: string | undefined, tags: Tag[]): string | null => {
  if (!section) return 'all';
  if (section === 'recommended' || section === 'watching') return section;
  return tags.find((tag) => getTagSlug(tag) === section)?.id || null;
};

export const buildSectionPath = (tagId: string, tags: Tag[]) => {
  if (tagId === 'all') return '/';
  if (tagId === 'recommended' || tagId === 'watching') return `/${tagId}`;
  const tag = tags.find((item) => item.id === tagId);
  return tag ? `/${getTagSlug(tag)}` : '/';
};

export const resolveLegacySection = (value: string, tags: Tag[]): string | null => {
  if (value === 'recommended' || value === 'watching') return value;
  const tagById = tags.find((tag) => tag.id === value);
  if (tagById) return getTagSlug(tagById);
  return tags.find((tag) => getTagSlug(tag) === value) ? value : null;
};

export const sectionFromCard = (card: CardData, tags: Tag[]) => {
  // 第一个标签是无上下文卡片链接的主路由
  const firstTagId = card.tagIds[0];
  if (firstTagId) {
    const tag = tags.find((item) => item.id === firstTagId);
    if (tag) return getTagSlug(tag);
  }
  if (card.isRecommended) return 'recommended';
  if (card.isWatching) return 'watching';
  return 'recommended';
};
