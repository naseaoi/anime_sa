import { dbGetJson, dbGetMedia, dbListMediaNames, dbSetJson, dbSetMedia } from '../core/kvStore.js';
import { normalizeMediaName } from '../sharedSecurity.js';
import { listRedisMediaNames, readRedisJson, readRedisMedia, saveRedisMedia, writeRedisJson } from './redisStore.js';
import { normalizePublicDataPayload } from '../publicDataValidation.js';

export const TRANSFER_DATA_KEYS = ['public_data', 'private_data'];

export const createSqliteTransferDriver = (db) => ({
  mode: 'sqlite',
  readJson: async (key) => dbGetJson(db, key),
  writeJson: async (key, value) => { dbSetJson(db, key, value); },
  listMediaNames: async () => dbListMediaNames(db),
  readMedia: async (name) => dbGetMedia(db, name),
  writeMedia: async (name, media) => dbSetMedia(db, name, media.contentType, media.bytes)
});

export const createRedisTransferDriver = (redis, env) => ({
  mode: 'redis',
  readJson: (key) => readRedisJson(redis, env, key),
  writeJson: (key, value) => writeRedisJson(redis, env, key, value),
  listMediaNames: () => listRedisMediaNames(redis, env),
  readMedia: (name) => readRedisMedia(redis, env, name),
  writeMedia: (name, media) => saveRedisMedia(redis, env, name, media.contentType, media.bytes)
});

export const transferStorageData = async (source, target) => {
  const copied = [];
  for (const key of TRANSFER_DATA_KEYS) {
    let value = await source.readJson(key);
    if (value === null || value === undefined) continue;
    if (key === 'public_data') {
      value = normalizePublicDataPayload(value);
      if (!value) throw new Error('Source public_data is invalid');
    }
    await target.writeJson(key, value);
    copied.push(key);
  }
  return { copied };
};

export const transferStorageMediaBatch = async (source, target, limit = 50) => {
  const sourceNames = [];
  const seen = new Set();
  for (const rawName of await source.listMediaNames()) {
    const name = normalizeMediaName(rawName);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    sourceNames.push(name);
  }

  const targetNames = new Set(await target.listMediaNames());
  const missing = sourceNames.filter((name) => !targetNames.has(name));
  const batch = missing.slice(0, Math.max(1, limit));

  let copied = 0;
  for (const name of batch) {
    const value = source.readMedia
      ? await source.readMedia(name)
      : await source.readJson(`media:${name}`);
    if (value === null || value === undefined) continue;
    if (target.writeMedia && value.bytes) {
      await target.writeMedia(name, value);
    } else {
      await target.writeJson(`media:${name}`, value);
    }
    copied += 1;
  }

  const skipped = batch.length - copied;
  const pending = Math.max(0, missing.length - batch.length);
  return { total: sourceNames.length, copied, skipped, pending, hasMore: pending > 0 };
};
