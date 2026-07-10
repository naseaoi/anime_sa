const MAX_TAGS = 200;
const MAX_CARDS = 2000;
const MAX_TAG_IDS_PER_CARD = 200;
const MAX_TEXT_LENGTH = 20000;
const MAX_ASSET_URL_LENGTH = 4096;
const MAX_LOCAL_ASSET_LENGTH = 1024 * 1024;

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

const readTimestamp = (value, optional = false) => {
  if (optional && (value === undefined || value === null)) return undefined;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp < 0) return null;
  return timestamp;
};

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
  const title = readString(value.title, 120);
  const iconUrl = readString(value.iconUrl, MAX_ASSET_URL_LENGTH);
  if (title === null || iconUrl === null || !isSafeAssetUrl(iconUrl, MAX_ASSET_URL_LENGTH)) return null;

  const themeColor = readOptionalString(value.themeColor, 7);
  if (themeColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) return null;

  const footerText = readOptionalString(value.footerText, 500);
  const footerLeft = readOptionalString(value.footerLeft, 500);
  const footerRight = readOptionalString(value.footerRight, 500);
  if (value.footerText !== undefined && footerText === null) return null;
  if (value.footerLeft !== undefined && footerLeft === null) return null;
  if (value.footerRight !== undefined && footerRight === null) return null;

  return { title, iconUrl, themeColor, footerText, footerLeft, footerRight };
};

const normalizeTags = (value) => {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const ids = new Set();
  const tags = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = readString(item.id, 80, false);
    const name = readString(item.name, 80, false);
    const slug = readOptionalString(item.slug, 100);
    const icon = readOptionalString(item.icon, 80);
    if (id === null || name === null || slug === null || icon === null || ids.has(id)) return null;
    ids.add(id);
    tags.push({ id, name, slug, icon });
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
    const id = readString(item.id, 80, false);
    const title = readString(item.title, 200, false);
    const coverUrl = readString(item.coverUrl ?? '', MAX_ASSET_URL_LENGTH);
    const coverLocalData = readOptionalString(item.coverLocalData, MAX_LOCAL_ASSET_LENGTH);
    const description = readString(item.description, MAX_TEXT_LENGTH);
    const startDate = readString(item.startDate, 40);
    const endDate = readString(item.endDate, 40);
    const createdAt = readTimestamp(item.createdAt);
    const updatedAt = readTimestamp(item.updatedAt);
    const rating = Number(item.rating);
    const coverVariants = normalizeCoverVariants(item.coverVariants);

    if (
      id === null || title === null || coverUrl === null || coverLocalData === null || description === null ||
      startDate === null || endDate === null || createdAt === null || updatedAt === null ||
      coverVariants === null || ids.has(id) || !isSafeAssetUrl(coverUrl, MAX_ASSET_URL_LENGTH) ||
      (coverLocalData !== undefined && !isSafeAssetUrl(coverLocalData, MAX_LOCAL_ASSET_LENGTH)) ||
      !Number.isFinite(rating) || rating < 0 || rating > 5 ||
      !Array.isArray(item.tagIds) || item.tagIds.length > MAX_TAG_IDS_PER_CARD
    ) return null;

    const cardTagIds = [];
    for (const tagIdValue of item.tagIds) {
      const tagId = readString(tagIdValue, 80, false);
      if (tagId === null || !tagIds.has(tagId) || cardTagIds.includes(tagId)) return null;
      cardTagIds.push(tagId);
    }

    ids.add(id);
    cards.push({
      id,
      title,
      coverUrl,
      coverVariants,
      coverLocalData,
      description,
      startDate,
      endDate,
      rating,
      tagIds: cardTagIds,
      isRecommended: item.isRecommended === true,
      isWatching: item.isWatching === true,
      createdAt,
      updatedAt
    });
  }
  return cards;
};

export const getPublicDataUpdatedAt = (value) => {
  if (!isRecord(value)) return 0;
  const direct = readTimestamp(value.updatedAt, true);
  if (direct !== null && direct !== undefined) return direct;
  if (!Array.isArray(value.cards)) return 0;
  return value.cards.reduce((max, card) => {
    const timestamp = readTimestamp(card?.updatedAt, true);
    return timestamp === null || timestamp === undefined ? max : Math.max(max, timestamp);
  }, 0);
};

export const normalizePublicDataPayload = (value) => {
  if (!isRecord(value)) return null;
  const settings = normalizeSettings(value.settings);
  const tagResult = normalizeTags(value.tags);
  if (!settings || !tagResult) return null;
  const cards = normalizeCards(value.cards, tagResult.ids);
  if (!cards) return null;

  const version = readTimestamp(value.version, true);
  const updatedAt = readTimestamp(value.updatedAt, true);
  if (version === null || updatedAt === null) return null;

  return {
    version,
    updatedAt: updatedAt ?? getPublicDataUpdatedAt({ cards }),
    settings,
    tags: tagResult.tags,
    cards
  };
};
