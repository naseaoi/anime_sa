const RESERVED = new Set(['recommended', 'watching', 'tat', 'card']);

/** @param {string} value */
export const slugifyName = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '');

/** @param {string | undefined} slug @param {string} fallbackName */
export const normalizeTagSlug = (slug, fallbackName) => {
  const fromSlug = slug ? slugifyName(slug) : '';
  const base = (fromSlug && fromSlug !== 'tag' ? fromSlug : slugifyName(fallbackName)) || 'tag';
  return RESERVED.has(base) ? `${base}-tag` : base;
};

/** @param {{ id: string, name: string, slug?: string }} tag */
export const getTagSlug = (tag) => {
  const base = normalizeTagSlug(tag.slug, tag.name);
  return base === 'tag' ? `tag-${tag.id}` : base;
};
