import { describe, expect, it } from 'vitest';
import { applyDerivedPublicDataVersion, DEFAULT_PUBLIC_DATA } from './publicData';
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
});
