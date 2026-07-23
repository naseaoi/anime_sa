import { describe, expect, it } from 'vitest';
import {
  readCachedSiteSettings,
  readSortConfig,
  readThemeMode,
  readVisibleCount,
  writeScrollPosition,
  writeVisibleCount
} from './browserState';

const makeStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
};

describe('browserState', () => {
  it('rejects invalid cached settings and accepts normalized settings', () => {
    const invalid = makeStorage({ tat_site_settings: JSON.stringify({ title: 1 }) });
    expect(readCachedSiteSettings(invalid)).toBeNull();

    const valid = makeStorage({ tat_site_settings: JSON.stringify({ title: '收藏', iconUrl: '' }) });
    expect(readCachedSiteSettings(valid)).toMatchObject({ title: '收藏', iconUrl: '' });
  });

  it('falls back for invalid theme and sort values', () => {
    expect(readThemeMode(makeStorage({ tat_theme: 'invalid' }))).toBe('system');
    expect(readSortConfig(makeStorage({ tat_sort_config: JSON.stringify({ key: 'unknown', order: 'asc' }) })))
      .toEqual({ key: 'createdAt', order: 'desc' });
  });

  it('bounds visible count and writes a stable integer', () => {
    expect(readVisibleCount(32, 2000, makeStorage({ tat_visible_count: 'not-a-number' }))).toBe(32);
    expect(readVisibleCount(32, 2000, makeStorage({ tat_visible_count: '9999' }))).toBe(2000);

    const storage = makeStorage();
    writeVisibleCount(12.8, storage);
    expect(storage.getItem('tat_visible_count')).toBe('12');
    expect(writeScrollPosition('scroll', NaN, storage)).toBe(false);
    expect(storage.getItem('scroll')).toBeNull();
  });
});
