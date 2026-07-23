import { getTagSlug, slugifyName } from '../shared/tagSlug.js';

/**
 * @typedef {object} PublicTag
 * @property {string} id
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [icon]
 */

/**
 * @typedef {object} PublicCard
 * @property {string} id
 * @property {string} title
 * @property {string} coverUrl
 * @property {{thumb?: string, card?: string, original?: string}} [coverVariants]
 * @property {string} [coverLocalData]
 * @property {string} description
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} rating
 * @property {string[]} tagIds
 * @property {boolean} isRecommended
 * @property {boolean} isWatching
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {object} PublicSettings
 * @property {string} title
 * @property {string} iconUrl
 * @property {string} [themeColor]
 * @property {string} [footerText]
 * @property {string} [footerLeft]
 * @property {string} [footerRight]
 */

/**
 * @typedef {object} PublicData
 * @property {number} [version]
 * @property {number} [updatedAt]
 * @property {string} revision
 * @property {PublicSettings} settings
 * @property {PublicTag[]} tags
 * @property {PublicCard[]} cards
 */

export const PUBLIC_DATA_LIMITS = Object.freeze({
  maxTags: 200,
  maxCards: 2000,
  maxTagIdsPerCard: 200,
  maxTitleLength: 200,
  maxTextLength: 20000,
  maxAssetUrlLength: 4096,
  maxLocalAssetLength: 1024 * 1024,
  maxDateLength: 40,
  maxIdLength: 80,
  maxSettingsTitleLength: 120,
  maxTagNameLength: 80,
  maxTagSlugLength: 100,
  maxTagIconLength: 80,
  maxFooterLength: 500,
  minRating: 0,
  maxRating: 5,
  maxRevisionLength: 128
});

const {
  maxTags: MAX_TAGS,
  maxCards: MAX_CARDS,
  maxTagIdsPerCard: MAX_TAG_IDS_PER_CARD,
  maxTitleLength: MAX_TITLE_LENGTH,
  maxTextLength: MAX_TEXT_LENGTH,
  maxAssetUrlLength: MAX_ASSET_URL_LENGTH,
  maxLocalAssetLength: MAX_LOCAL_ASSET_LENGTH,
  maxDateLength: MAX_DATE_LENGTH,
  maxIdLength: MAX_ID_LENGTH,
  maxSettingsTitleLength: MAX_SETTINGS_TITLE_LENGTH,
  maxTagNameLength: MAX_TAG_NAME_LENGTH,
  maxTagSlugLength: MAX_TAG_SLUG_LENGTH,
  maxTagIconLength: MAX_TAG_ICON_LENGTH,
  maxFooterLength: MAX_FOOTER_LENGTH,
  minRating: MIN_RATING,
  maxRating: MAX_RATING,
  maxRevisionLength: MAX_REVISION_LENGTH
} = PUBLIC_DATA_LIMITS;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const readString = (value, maxLength, allowEmpty = true) => {
  if (typeof value !== 'string') return null;
  if (value.length > maxLength) return null;
  if (!allowEmpty && value.trim().length === 0) return null;
  return value;
};

const readOptionalString = (value, maxLength) => {
  if (value === undefined || value === null || value === '') return undefined;
  return readString(value, maxLength);
};

const readRevision = (value) => {
  if (typeof value !== 'string') return null;
  const revision = value.trim();
  return revision && revision.length <= MAX_REVISION_LENGTH ? revision : null;
};

const readTimestamp = (value, optional = false) => {
  if (optional && (value === undefined || value === null)) return undefined;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0) return null;
  return timestamp;
};

/** @param {unknown} value @param {number} maxLength */
const isSafeAssetUrl = (value, maxLength) => {
  if (typeof value !== 'string' || value.length > maxLength) return false;
  if (!value) return true;
  if (value.startsWith('/')) return true;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeSettings = (value) => {
  if (!isRecord(value)) return null;
  const title = readString(value.title, MAX_SETTINGS_TITLE_LENGTH);
  const iconUrl = readString(value.iconUrl, MAX_ASSET_URL_LENGTH);
  if (title === null || iconUrl === null || !isSafeAssetUrl(iconUrl, MAX_ASSET_URL_LENGTH)) return null;

  const themeColor = readOptionalString(value.themeColor, 7);
  if (themeColor === null) return null;
  if (themeColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) return null;

  const footerText = readOptionalString(value.footerText, MAX_FOOTER_LENGTH);
  const footerLeft = readOptionalString(value.footerLeft, MAX_FOOTER_LENGTH);
  const footerRight = readOptionalString(value.footerRight, MAX_FOOTER_LENGTH);
  if (value.footerText !== undefined && footerText === null) return null;
  if (value.footerLeft !== undefined && footerLeft === null) return null;
  if (value.footerRight !== undefined && footerRight === null) return null;

  return {
    title,
    iconUrl,
    themeColor: themeColor ?? undefined,
    footerText: footerText ?? undefined,
    footerLeft: footerLeft ?? undefined,
    footerRight: footerRight ?? undefined
  };
};

const normalizeTags = (value) => {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const ids = new Set();
  const slugs = new Set();
  const tags = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = readString(item.id, MAX_ID_LENGTH, false);
    const name = readString(item.name, MAX_TAG_NAME_LENGTH, false);
    const slug = readOptionalString(item.slug, MAX_TAG_SLUG_LENGTH);
    const icon = readOptionalString(item.icon, MAX_TAG_ICON_LENGTH);
    if (id === null || name === null || slug === null || icon === null || ids.has(id)) return null;
    const tag = { id, name, slug, icon };
    let uniqueSlug = getTagSlug(tag);
    if (slugs.has(uniqueSlug)) {
      const suffix = slugifyName(id) || 'tag';
      let index = 0;
      do {
        const extra = index === 0 ? suffix : `${suffix}-${index}`;
        const prefix = uniqueSlug.slice(0, Math.max(1, MAX_TAG_SLUG_LENGTH - extra.length - 1));
        uniqueSlug = `${prefix}-${extra}`;
        index += 1;
      } while (slugs.has(uniqueSlug));
      tag.slug = uniqueSlug;
    }
    slugs.add(uniqueSlug);
    ids.add(id);
    tags.push(tag);
  }
  return { tags, ids };
};

const normalizeCoverVariants = (value) => {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) return null;
  const variants = {};
  for (const key of ['thumb', 'card', 'original']) {
    const url = readOptionalString(value[key], MAX_ASSET_URL_LENGTH);
    if (url === null || (url !== undefined && !isSafeAssetUrl(url, MAX_ASSET_URL_LENGTH))) return null;
    if (url !== undefined) variants[key] = url;
  }
  return variants;
};

const normalizeCards = (value, tagIds) => {
  if (!Array.isArray(value) || value.length > MAX_CARDS) return null;
  const ids = new Set();
  const cards = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = readString(item.id, MAX_ID_LENGTH, false);
    const title = readString(item.title, MAX_TITLE_LENGTH, false);
    const coverUrl = readString(item.coverUrl ?? '', MAX_ASSET_URL_LENGTH);
    const coverLocalData = readOptionalString(item.coverLocalData, MAX_LOCAL_ASSET_LENGTH);
    const description = readString(item.description, MAX_TEXT_LENGTH);
    const startDate = readString(item.startDate, MAX_DATE_LENGTH);
    const endDate = readString(item.endDate, MAX_DATE_LENGTH);
    const createdAt = readTimestamp(item.createdAt);
    const updatedAt = readTimestamp(item.updatedAt);
    const rating = Number(item.rating);
    const coverVariants = normalizeCoverVariants(item.coverVariants);

    if (
      id === null || title === null || coverUrl === null || coverLocalData === null || description === null ||
      startDate === null || endDate === null || createdAt === null || updatedAt === null ||
      coverVariants === null || ids.has(id) || !isSafeAssetUrl(coverUrl, MAX_ASSET_URL_LENGTH) ||
      (coverLocalData !== undefined && !isSafeAssetUrl(coverLocalData, MAX_LOCAL_ASSET_LENGTH)) ||
      !Number.isFinite(rating) || rating < MIN_RATING || rating > MAX_RATING ||
      !Array.isArray(item.tagIds) || item.tagIds.length > MAX_TAG_IDS_PER_CARD
    ) return null;

    const cardTagIds = [];
    for (const tagIdValue of item.tagIds) {
      const tagId = readString(tagIdValue, MAX_ID_LENGTH, false);
      if (tagId === null || !tagIds.has(tagId) || cardTagIds.includes(tagId)) return null;
      cardTagIds.push(tagId);
    }

    ids.add(id);
    cards.push({
      id,
      title,
      coverUrl,
      coverVariants,
      coverLocalData: coverLocalData ?? undefined,
      description,
      startDate,
      endDate,
      rating,
      tagIds: cardTagIds,
      isRecommended: item.isRecommended === true,
      isWatching: item.isWatching === true,
      createdAt: /** @type {number} */ (createdAt),
      updatedAt: /** @type {number} */ (updatedAt)
    });
  }
  return cards;
};

/** @param {unknown} value */
export const getPublicDataUpdatedAt = (value) => {
  if (!isRecord(value)) return 0;
  const direct = readTimestamp(value.updatedAt, true);
  if (direct !== null && direct !== undefined) return direct;
  if (!Array.isArray(value.cards)) return 0;
  return /** @type {Array<Record<string, unknown>>} */ (value.cards).reduce((max, card) => {
    const timestamp = readTimestamp(card?.updatedAt, true);
    return timestamp === null || timestamp === undefined ? max : Math.max(max, timestamp);
  }, 0);
};

export const getPublicDataRevision = (value) => {
  if (!isRecord(value)) return 'legacy:0';
  const direct = readRevision(value.revision);
  return direct || `legacy:${getPublicDataUpdatedAt(value)}`;
};

/**
 * @param {unknown} value
 * @returns {PublicData|null}
 */
export const normalizePublicDataPayload = (value) => {
  if (!isRecord(value)) return null;
  const settings = normalizeSettings(value.settings);
  const tagResult = normalizeTags(value.tags);
  if (!settings || !tagResult) return null;
  const cards = normalizeCards(value.cards, tagResult.ids);
  if (!cards) return null;

  const version = readTimestamp(value.version, true);
  const updatedAt = readTimestamp(value.updatedAt, true);
  const revision = value.revision === undefined ? getPublicDataRevision({ ...value, updatedAt, cards }) : readRevision(value.revision);
  if (version === null || updatedAt === null || revision === null) return null;

  return {
    version,
    updatedAt: updatedAt ?? getPublicDataUpdatedAt({ cards }),
    revision,
    settings,
    tags: tagResult.tags,
    cards
  };
};
