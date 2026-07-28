import { describe, expect, it, vi } from 'vitest';
import { createFileStatCache } from './fileStatCache.js';

const fileStat = { isDirectory: () => false };

describe('file stat cache', () => {
  it('reuses entries until they expire', async () => {
    let currentTime = 0;
    const stat = vi.fn(async () => fileStat);
    const cache = createFileStatCache({ ttlMs: 10, stat, now: () => currentTime });

    await cache.get('a.js');
    await cache.get('a.js');
    currentTime = 11;
    await cache.get('a.js');

    expect(stat).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache within its configured capacity', async () => {
    const cache = createFileStatCache({ maxEntries: 2, stat: async () => fileStat });

    await cache.get('a.js');
    await cache.get('b.js');
    await cache.get('c.js');

    expect(cache.size()).toBe(2);
  });
});
