import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  createRedisTransferDriver,
  createSqliteTransferDriver,
  transferStorageData,
  transferStorageMediaBatch,
  TRANSFER_DATA_KEYS
} from './transfer.js';

const createMemoryDriver = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    readJson: async (key) => (store.has(key) ? store.get(key) : null),
    writeJson: async (key, value) => { store.set(key, value); },
    listMediaNames: async () => [...store.keys()]
      .filter((key) => key.startsWith('media:'))
      .map((key) => key.slice('media:'.length))
  };
};

const createPublicData = (updatedAt) => ({
  settings: { title: '收藏', iconUrl: '' },
  tags: [],
  cards: [],
  updatedAt
});

describe('storage transfer', () => {
  it('copies public and private data to the target', async () => {
    const source = createMemoryDriver({
      public_data: createPublicData(42),
      private_data: { username: 'admin', passwordHash: 'hash' }
    });
    const target = createMemoryDriver({
      public_data: { updatedAt: 1, cards: [{ id: 'stale' }] }
    });

    const result = await transferStorageData(source, target);

    expect(result.copied).toEqual(TRANSFER_DATA_KEYS);
    expect(target.store.get('public_data')).toMatchObject(createPublicData(42));
    expect(target.store.get('private_data')).toEqual({ username: 'admin', passwordHash: 'hash' });
  });

  it('skips missing data keys without writing them', async () => {
    const source = createMemoryDriver({ public_data: createPublicData(7) });
    const target = createMemoryDriver();

    const result = await transferStorageData(source, target);

    expect(result.copied).toEqual(['public_data']);
    expect(target.store.has('private_data')).toBe(false);
  });

  it('rejects invalid public data before overwriting the target', async () => {
    const source = createMemoryDriver({ public_data: { updatedAt: 7, cards: [] } });
    const target = createMemoryDriver({ public_data: createPublicData(1) });

    await expect(transferStorageData(source, target)).rejects.toThrow('Source public_data is invalid');
    expect(target.store.get('public_data')).toEqual(createPublicData(1));
  });

  it('copies only media missing from the target in batches', async () => {
    const source = createMemoryDriver({
      'media:a.webp': { contentType: 'image/webp', base64: 'aa' },
      'media:b.webp': { contentType: 'image/webp', base64: 'bb' },
      'media:c.webp': { contentType: 'image/webp', base64: 'cc' }
    });
    const target = createMemoryDriver({
      'media:a.webp': { contentType: 'image/webp', base64: 'aa' }
    });

    const first = await transferStorageMediaBatch(source, target, 1);
    expect(first.total).toBe(3);
    expect(first.copied).toBe(1);
    expect(first.pending).toBe(1);
    expect(first.hasMore).toBe(true);

    const second = await transferStorageMediaBatch(source, target, 10);
    expect(second.copied).toBe(1);
    expect(second.hasMore).toBe(false);
    expect(target.store.get('media:b.webp')).toEqual({ contentType: 'image/webp', base64: 'bb' });
    expect(target.store.get('media:c.webp')).toEqual({ contentType: 'image/webp', base64: 'cc' });
  });

  it('reports vanished media entries as skipped', async () => {
    const source = createMemoryDriver({
      'media:a.webp': { contentType: 'image/webp', base64: 'aa' }
    });
    source.readJson = async () => null;
    const target = createMemoryDriver();

    const result = await transferStorageMediaBatch(source, target, 10);

    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('drops invalid media names before copying', async () => {
    const source = createMemoryDriver({
      'media:../evil': { contentType: 'text/plain', base64: 'xx' },
      'media:ok.webp': { contentType: 'image/webp', base64: 'aa' }
    });
    const target = createMemoryDriver();

    const result = await transferStorageMediaBatch(source, target, 10);

    expect(result.total).toBe(1);
    expect(result.copied).toBe(1);
    expect(target.store.has('media:ok.webp')).toBe(true);
    expect(target.store.has('media:../evil')).toBe(false);
  });
});

class FakeRedis {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value) { this.values.set(key, value); return 'OK'; }
  async *scanIterator({ MATCH }) {
    const prefix = String(MATCH || '').replace(/\*$/, '');
    yield [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }
}

const createSqliteDb = () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)');
  return db;
};

describe('storage transfer driver integration', () => {
  const env = { REDIS_PREFIX: 'test' };

  it('moves data and media from sqlite to redis', async () => {
    const db = createSqliteDb();
    const redis = new FakeRedis();
    const source = createSqliteTransferDriver(db);
    const target = createRedisTransferDriver(redis, env);

    await source.writeJson('public_data', createPublicData(9));
    await source.writeJson('private_data', { username: 'admin', passwordHash: 'hash' });
    await source.writeJson('media:cover.webp', { contentType: 'image/webp', base64: 'aa' });

    const dataResult = await transferStorageData(source, target);
    const mediaResult = await transferStorageMediaBatch(source, target, 10);

    expect(dataResult.copied).toEqual(TRANSFER_DATA_KEYS);
    expect(mediaResult.copied).toBe(1);
    expect(JSON.parse(redis.values.get('test:public_data'))).toMatchObject(createPublicData(9));
    expect(JSON.parse(redis.values.get('test:media:cover.webp'))).toEqual({ contentType: 'image/webp', base64: 'aa' });
  });

  it('moves data and media from redis back to sqlite', async () => {
    const db = createSqliteDb();
    const redis = new FakeRedis();
    const source = createRedisTransferDriver(redis, env);
    const target = createSqliteTransferDriver(db);

    await source.writeJson('public_data', createPublicData(12));
    await source.writeJson('media:cover.webp', { contentType: 'image/webp', base64: 'bb' });

    const dataResult = await transferStorageData(source, target);
    const mediaResult = await transferStorageMediaBatch(source, target, 10);

    expect(dataResult.copied).toEqual(['public_data']);
    expect(mediaResult.copied).toBe(1);
    expect(await target.readJson('public_data')).toMatchObject(createPublicData(12));
    expect(await target.readJson('media:cover.webp')).toEqual({ contentType: 'image/webp', base64: 'bb' });
  });

  it('reruns without duplicating media already present in the target', async () => {
    const db = createSqliteDb();
    const redis = new FakeRedis();
    const source = createSqliteTransferDriver(db);
    const target = createRedisTransferDriver(redis, env);

    await source.writeJson('media:cover.webp', { contentType: 'image/webp', base64: 'aa' });
    await transferStorageMediaBatch(source, target, 10);
    const rerun = await transferStorageMediaBatch(source, target, 10);

    expect(rerun.copied).toBe(0);
    expect(rerun.pending).toBe(0);
    expect(rerun.hasMore).toBe(false);
  });
});
