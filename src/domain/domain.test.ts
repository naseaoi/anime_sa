import { describe, expect, it } from 'vitest';
import {
  applyDerivedPublicDataVersion,
  DEFAULT_ICON_URL,
  DEFAULT_NAV_ICON_URL,
  DEFAULT_PUBLIC_DATA,
  resolveNavigationIconUrl,
  resolveSiteIconUrl
} from './publicData';
import { isStorageMode, STORAGE_MODES } from './storage';

describe('storage domain', () => {
  it('accepts registered storage modes', () => {
    expect(STORAGE_MODES).toEqual(['sqlite', 'redis']);
    expect(isStorageMode('sqlite')).toBe(true);
    expect(isStorageMode('redis')).toBe(true);
    expect(isStorageMode('local')).toBe(false);
  });
});

describe('public data domain', () => {
  it('derives updatedAt from the latest card', () => {
    const input: { updatedAt?: number; cards: Array<{ updatedAt?: number }> } = {
      cards: [{ updatedAt: 10 }, { updatedAt: 25 }]
    };
    const data = applyDerivedPublicDataVersion(input);
    expect(data.updatedAt).toBe(25);
  });

  it('uses a storage timestamp before card timestamps', () => {
    const input: { updatedAt?: number; cards: Array<{ updatedAt?: number }> } = {
      cards: [{ updatedAt: 25 }]
    };
    const data = applyDerivedPublicDataVersion(input, 50);
    expect(data.updatedAt).toBe(50);
  });

  it('keeps default data free of cards', () => {
    expect(DEFAULT_PUBLIC_DATA.cards).toEqual([]);
  });

  it('uses the default icon when the configured URL is blank', () => {
    expect(resolveSiteIconUrl('')).toBe(DEFAULT_ICON_URL);
    expect(resolveSiteIconUrl('   ')).toBe(DEFAULT_ICON_URL);
    expect(resolveSiteIconUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });

  it('uses a compact navigation icon for the default site icon', () => {
    expect(resolveNavigationIconUrl('')).toBe(DEFAULT_NAV_ICON_URL);
    expect(resolveNavigationIconUrl(DEFAULT_ICON_URL)).toBe(DEFAULT_NAV_ICON_URL);
    expect(resolveNavigationIconUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });
});
