import type { SiteSettings } from '../types';
import { normalizePublicDataPayload } from '../../shared/publicDataSchema.js';

export type ThemeMode = 'light' | 'dark' | 'system';
export type SortKey = 'createdAt' | 'rating' | 'updatedAt';
export type SortOrder = 'desc' | 'asc';
export interface SortConfig {
  key: SortKey;
  order: SortOrder;
}

export const BROWSER_STATE_KEYS = Object.freeze({
  siteSettings: 'tat_site_settings',
  theme: 'tat_theme',
  sortConfig: 'tat_sort_config',
  visibleCount: 'tat_visible_count',
  reloginNotice: 'tat_relogin_notice'
});

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getStorage = (kind: 'local' | 'session'): BrowserStorage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

const readValue = (storage: BrowserStorage | null, key: string) => {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeValue = (storage: BrowserStorage | null, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
    return !!storage;
  } catch {
    return false;
  }
};

const removeValue = (storage: BrowserStorage | null, key: string) => {
  try {
    storage?.removeItem(key);
    return !!storage;
  } catch {
    return false;
  }
};

const isThemeMode = (value: unknown): value is ThemeMode => (
  value === 'light' || value === 'dark' || value === 'system'
);

const isSortKey = (value: unknown): value is SortKey => (
  value === 'createdAt' || value === 'rating' || value === 'updatedAt'
);

const isSortOrder = (value: unknown): value is SortOrder => value === 'asc' || value === 'desc';

export const readCachedSiteSettings = (storage = getStorage('local')): SiteSettings | null => {
  const raw = readValue(storage, BROWSER_STATE_KEYS.siteSettings);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const normalized = normalizePublicDataPayload({
      version: 0,
      updatedAt: 0,
      revision: 'legacy:0',
      settings: value,
      tags: [],
      cards: []
    });
    return normalized?.settings || null;
  } catch {
    return null;
  }
};

export const writeCachedSiteSettings = (settings: SiteSettings, storage = getStorage('local')) => (
  writeValue(storage, BROWSER_STATE_KEYS.siteSettings, JSON.stringify(settings))
);

export const readThemeMode = (storage = getStorage('local')): ThemeMode => {
  const value = readValue(storage, BROWSER_STATE_KEYS.theme);
  return isThemeMode(value) ? value : 'system';
};

export const writeThemeMode = (theme: ThemeMode, storage = getStorage('local')) => (
  writeValue(storage, BROWSER_STATE_KEYS.theme, theme)
);

export const readSortConfig = (storage = getStorage('session')): SortConfig => {
  const raw = readValue(storage, BROWSER_STATE_KEYS.sortConfig);
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === 'object' && value !== null) {
        const candidate = value as { key?: unknown; order?: unknown };
        if (isSortKey(candidate.key) && isSortOrder(candidate.order)) {
          return { key: candidate.key, order: candidate.order };
        }
      }
    } catch {
      return { key: 'createdAt', order: 'desc' };
    }
  }
  return { key: 'createdAt', order: 'desc' };
};

export const writeSortConfig = (config: SortConfig, storage = getStorage('session')) => (
  writeValue(storage, BROWSER_STATE_KEYS.sortConfig, JSON.stringify(config))
);

export const readVisibleCount = (fallback: number, max: number, storage = getStorage('session')) => {
  const raw = readValue(storage, BROWSER_STATE_KEYS.visibleCount);
  const value = raw === null ? NaN : Number(raw);
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, max);
};

export const writeVisibleCount = (value: number, storage = getStorage('session')) => {
  if (!Number.isFinite(value)) return false;
  return writeValue(storage, BROWSER_STATE_KEYS.visibleCount, String(Math.max(1, Math.floor(value))));
};

export const getHomeScrollKey = (path: string, search: string) => `tat_home_scroll:${path}${search}`;

export const readScrollPosition = (key: string, storage = getStorage('session')) => {
  const raw = readValue(storage, key);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export const writeScrollPosition = (key: string, value: number, storage = getStorage('session')) => {
  if (!Number.isFinite(value)) return false;
  return writeValue(storage, key, String(Math.max(0, Math.floor(value))));
};

export const clearScrollPosition = (key: string, storage = getStorage('session')) => removeValue(storage, key);

export const readReloginNotice = (storage = getStorage('session')) => (
  readValue(storage, BROWSER_STATE_KEYS.reloginNotice) === '1'
);

export const writeReloginNotice = (storage = getStorage('session')) => (
  writeValue(storage, BROWSER_STATE_KEYS.reloginNotice, '1')
);

export const clearReloginNotice = (storage = getStorage('session')) => (
  removeValue(storage, BROWSER_STATE_KEYS.reloginNotice)
);
