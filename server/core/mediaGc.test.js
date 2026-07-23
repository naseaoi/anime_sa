import { describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { cleanupSqliteUnusedMedia, MEDIA_GC_GRACE_MS } from './mediaGc.js';
import { dbGetMedia, dbSetMedia } from './kvStore.js';

const createDb = () => {
  const database = new Database(':memory:');
  database.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT)');
  return database;
};

describe('media garbage collection', () => {
  it('keeps fresh uploads and removes expired unreferenced media', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(now - MEDIA_GC_GRACE_MS - 1)
      .mockReturnValueOnce(now);
    const database = createDb();
    dbSetMedia(database, 'old.webp', 'image/webp', Buffer.from('old'));
    dbSetMedia(database, 'fresh.webp', 'image/webp', Buffer.from('fresh'));

    const result = cleanupSqliteUnusedMedia(database, new Set(), 100, now);

    expect(result).toEqual({ checked: 2, removed: 1, deferred: 1, pending: 0, hasMore: false });
    expect(dbGetMedia(database, 'old.webp')).toBeNull();
    expect(dbGetMedia(database, 'fresh.webp')).not.toBeNull();
    database.close();
    vi.restoreAllMocks();
  });

  it('keeps referenced media regardless of age', () => {
    const database = createDb();
    vi.spyOn(Date, 'now').mockReturnValue(1);
    dbSetMedia(database, 'used.webp', 'image/webp', Buffer.from('used'));

    const result = cleanupSqliteUnusedMedia(database, new Set(['used.webp']), 100, MEDIA_GC_GRACE_MS + 2);

    expect(result.removed).toBe(0);
    expect(result.deferred).toBe(0);
    expect(dbGetMedia(database, 'used.webp')).not.toBeNull();
    database.close();
    vi.restoreAllMocks();
  });
});
