import { CardData, Tag } from '../types';
import { getTagSlug } from '../../shared/tagSlug.js';

export { getTagSlug, normalizeTagSlug, slugifyName } from '../../shared/tagSlug.js';

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
