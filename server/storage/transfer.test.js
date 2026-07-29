import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { hashPassword, verifyPasswordHash } from '../sharedSecurity.js';
import {
  createRedisTransferDriver,
  createSqliteTransferDriver,
  transferStorageData,
  transferStorageMediaBatch
} from './transfer.js';

const createMemoryDriver = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    sessionsCleared: 0,
    readJson: async (key) => (store.has(key) ? store.get(key) : null),
    writeJson: async (key, value) => { store.set(key, value); },
    replaceData: async function replaceData(values) {
      const next = new Map(store);
      for (const [key, value] of values) next.set(key, value);
      store.clear();
      for (const [key, value] of next) store.set(key, value);
      if (values.has('private_data')) this.sessionsCleared += 1;
    },
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
    const passwordHash = await hashPassword('secret');
    const source = createMemoryDriver({
      public_data: createPublicData(42),
      private_data: { username: 'admin', passwordHash }
    });
    const target = createMemoryDriver({
      public_data: { updatedAt: 1, cards: [{ id: 'stale' }] }
    });

    const result = await transferStorageData(source, target);

    expect(result.copied).toEqual(['private_data', 'public_data']);
    expect(result.credentialsChanged).toBe(true);
    expect(target.sessionsCleared).toBe(1);
    expect(target.store.get('public_data')).toMatchObject(createPublicData(42));
    expect(target.store.get('private_data')).toEqual({ username: 'admin', passwordHash });
  });

  it('skips missing data keys without writing them', async () => {
    const source = createMemoryDriver({ public_data: createPublicData(7) });
    const target = createMemoryDriver();

    const result = await transferStorageData(source, target);

    expect(result.copied).toEqual(['public_data']);
    expect(result.credentialsChanged).toBe(false);
    expect(target.sessionsCleared).toBe(0);
    expect(target.store.has('private_data')).toBe(false);
  });

  it('rejects invalid public data before overwriting the target', async () => {
    const source = createMemoryDriver({ public_data: { updatedAt: 7, cards: [] } });
    const target = createMemoryDriver({ public_data: createPublicData(1) });

    await expect(transferStorageData(source, target)).rejects.toThrow('Source public_data is invalid');
    expect(target.store.get('public_data')).toEqual(createPublicData(1));
  });

  it('rejects invalid private data before overwriting public data', async () => {
    const source = createMemoryDriver({
      public_data: createPublicData(7),
      private_data: { username: 'admin', passwordHash: 'invalid' }
    });
    const target = createMemoryDriver({ public_data: createPublicData(1) });

    await expect(transferStorageData(source, target)).rejects.toThrow('Source private_data is invalid');
    expect(target.store.get('public_data')).toEqual(createPublicData(1));
  });

  it('upgrades legacy plaintext credentials during transfer', async () => {
    const source = createMemoryDriver({ private_data: { username: 'admin', password: 'legacy-secret' } });
    const target = createMemoryDriver();

    await transferStorageData(source, target);

    const credentials = target.store.get('private_data');
    expect(credentials.password).toBeUndefined();
    await expect(verifyPasswordHash('legacy-secret', credentials.passwordHash)).resolves.toBe(true);
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
  async del(input) {
    const keys = Array.isArray(input) ? input : [input];
    let removed = 0;
    for (const key of keys) removed += this.values.delete(key) ? 1 : 0;
    return removed;
  }
  async sMembers() { return []; }
  multi() {
    const operations = [];
    return {
      set: (key, value) => { operations.push(['set', key, value]); },
      del: (input) => { operations.push(['del', input]); },
      exec: async () => {
        const next = new Map(this.values);
        for (const [operation, key, value] of operations) {
          if (operation === 'set') next.set(key, value);
          else {
            const keys = Array.isArray(key) ? key : [key];
            keys.forEach((item) => next.delete(item));
          }
        }
        this.values = next;
      }
    };
  }
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
    const passwordHash = await hashPassword('secret');
    const db = createSqliteDb();
    const redis = new FakeRedis();
    const source = createSqliteTransferDriver(db);
    const target = createRedisTransferDriver(redis, env);

    await source.writeJson('public_data', createPublicData(9));
    await source.writeJson('private_data', { username: 'admin', passwordHash });
    await source.writeJson('media:cover.webp', { contentType: 'image/webp', base64: 'aa' });

    const dataResult = await transferStorageData(source, target);
    const mediaResult = await transferStorageMediaBatch(source, target, 10);

    expect(dataResult.copied).toEqual(['private_data', 'public_data']);
    expect(mediaResult.copied).toBe(1);
    expect(JSON.parse(redis.values.get('test:public_data'))).toMatchObject(createPublicData(9));
    expect(Buffer.isBuffer(redis.values.get('test:media:cover.webp'))).toBe(true);
    expect(JSON.parse(redis.values.get('test:media-meta:cover.webp'))).toMatchObject({ contentType: 'image/webp' });
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
    expect(await target.readMedia('cover.webp')).toEqual({
      contentType: 'image/webp',
      bytes: Buffer.from('bb', 'base64')
    });
  });

  it('rolls back sqlite data and sessions when an atomic replacement fails', async () => {
    const passwordHash = await hashPassword('secret');
    const db = createSqliteDb();
    const source = createMemoryDriver({
      public_data: createPublicData(12),
      private_data: { username: 'admin', passwordHash }
    });
    const target = createSqliteTransferDriver(db);

    await target.writeJson('public_data', createPublicData(1));
    await target.writeJson('session:existing', { expiresAt: Date.now() + 60_000 });
    db.exec(`
      CREATE TRIGGER fail_private_data BEFORE INSERT ON kv_store
      WHEN NEW.key = 'private_data'
      BEGIN
        SELECT RAISE(ABORT, 'injected transfer failure');
      END
    `);

    await expect(transferStorageData(source, target)).rejects.toThrow('injected transfer failure');
    expect(await target.readJson('public_data')).toMatchObject(createPublicData(1));
    expect(await target.readJson('private_data')).toBeNull();
    expect(await target.readJson('session:existing')).toMatchObject({ expiresAt: expect.any(Number) });
    db.close();
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
