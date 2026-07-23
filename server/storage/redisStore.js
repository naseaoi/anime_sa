import crypto from 'crypto';
import { createClient, RESP_TYPES } from 'redis';
import { AUDIT_LIMITS, normalizeAuditEntry } from '../core/auditContract.js';

let redisClient = null;
let redisIdentity = '';
let redisConnectPromise = null;

const getPrefix = (env) => String(env.REDIS_PREFIX || 'anime-sa').replace(/[^a-zA-Z0-9:_-]/g, '') || 'anime-sa';
const buildKey = (env, key) => `${getPrefix(env)}:${key}`;
const mediaKey = (env, name) => buildKey(env, `media:${name}`);
const mediaMetaKey = (env, name) => buildKey(env, `media-meta:${name}`);

const binaryClient = (redis) => {
  if (typeof redis.withTypeMapping !== 'function') return redis;
  return redis.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
};

export const getRedisClient = async (env) => {
  const url = String(env.REDIS_URL || '').trim();
  if (!url) throw new Error('Missing REDIS_URL');
  if (!redisClient || redisIdentity !== url) {
    if (redisClient?.isOpen) await redisClient.close();
    const client = createClient({ url });
    client.on('error', (error) => console.error('Redis client error:', error));
    redisClient = client;
    redisIdentity = url;
    // 初次连接失败时丢弃缓存实例，下次调用重建连接
    redisConnectPromise = client.connect().catch((error) => {
      if (redisClient === client) {
        redisClient = null;
        redisIdentity = '';
        redisConnectPromise = null;
      }
      throw error;
    });
  }
  if (!redisClient.isReady) await redisConnectPromise;
  return redisClient;
};

export const readRedisJson = async (redis, env, key) => {
  const raw = await redis.get(buildKey(env, key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const writeRedisJson = async (redis, env, key, value, options) => {
  await redis.set(buildKey(env, key), JSON.stringify(value), options);
};

export const deleteRedisKey = async (redis, env, key) => {
  await redis.del(buildKey(env, key));
};

export const saveRedisPublicData = async (redis, env, value, expectedUpdatedAt) => {
  const key = buildKey(env, 'public_data');
  const expected = expectedUpdatedAt === undefined ? '' : String(expectedUpdatedAt);
  const result = await redis.eval(
    "local current=redis.call('GET',KEYS[1]); if ARGV[1]~='' then local version=0; if current then local parsed=cjson.decode(current); version=tonumber(parsed.updatedAt) or 0 end; if version~=tonumber(ARGV[1]) then return tostring(version) end end; redis.call('SET',KEYS[1],ARGV[2]); return 'OK'",
    { keys: [key], arguments: [expected, JSON.stringify(value)] }
  );
  return result === 'OK' ? { success: true } : { success: false, currentUpdatedAt: Number(result || 0) };
};

const sessionKey = (env, token) => buildKey(env, `session:${token}`);
const sessionIndexKey = (env) => buildKey(env, 'sessions');
const auditKey = (env) => buildKey(env, 'audit');

export const createRedisSession = async (redis, env, remember) => {
  const token = crypto.randomBytes(32).toString('hex');
  const maxAgeSec = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const now = Date.now();
  const expiresAt = now + maxAgeSec * 1000;
  await writeRedisJson(redis, env, `session:${token}`, { createdAt: now, expiresAt }, { EX: maxAgeSec });
  await redis.sAdd(sessionIndexKey(env), token);
  await redis.expire(sessionIndexKey(env), 31 * 24 * 60 * 60);
  return { token, maxAgeSec, expiresAt };
};

export const verifyRedisSession = async (redis, env, token) => {
  if (!token) return false;
  const session = await readRedisJson(redis, env, `session:${token}`);
  if (!session || Number(session.expiresAt || 0) <= Date.now()) {
    await redis.del(sessionKey(env, token));
    await redis.sRem(sessionIndexKey(env), token);
    return false;
  }
  return true;
};

export const destroyRedisSession = async (redis, env, token) => {
  if (!token) return;
  await redis.del(sessionKey(env, token));
  await redis.sRem(sessionIndexKey(env), token);
};

export const clearRedisSessions = async (redis, env) => {
  const tokens = await redis.sMembers(sessionIndexKey(env));
  if (tokens.length > 0) await redis.del(tokens.map((token) => sessionKey(env, token)));
  await redis.del(sessionIndexKey(env));
};

export const consumeRateLimit = async (redis, env, scope, clientId, limit, windowSeconds) => {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = buildKey(env, `rate:${scope}:${clientId}:${bucket}`);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds + 5);
  return {
    allowed: count <= limit,
    retryAfter: Math.max(1, windowSeconds - Math.floor((Date.now() / 1000) % windowSeconds))
  };
};

export const appendRedisAudit = async (redis, env, entry) => {
  await redis.lPush(auditKey(env), JSON.stringify({
    id: String(entry?.id || crypto.randomUUID()),
    ts: Number(entry?.ts || Date.now()),
    ...normalizeAuditEntry(entry)
  }));
  await redis.lTrim(auditKey(env), 0, AUDIT_LIMITS.entries - 1);
};

export const readRedisAudit = async (redis, env, limit) => {
  const values = await redis.lRange(auditKey(env), 0, Math.max(0, limit - 1));
  return values.map((value) => {
    try { return JSON.parse(value); } catch { return null; }
  }).filter(Boolean);
};

export const saveRedisMedia = async (redis, env, name, contentType, bytes) => {
  await binaryClient(redis).set(mediaKey(env, name), Buffer.from(bytes));
  await writeRedisJson(redis, env, `media-meta:${name}`, { contentType, updatedAt: Date.now() });
};

export const readRedisMedia = async (redis, env, name) => {
  const raw = await binaryClient(redis).get(mediaKey(env, name));
  if (!raw) return null;
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
  const meta = await readRedisJson(redis, env, `media-meta:${name}`);
  if (meta) return { contentType: String(meta.contentType || 'application/octet-stream'), bytes };

  try {
    const legacy = JSON.parse(bytes.toString('utf8'));
    if (!legacy?.base64) return null;
    const migratedBytes = Buffer.from(legacy.base64, 'base64');
    await saveRedisMedia(redis, env, name, String(legacy.contentType || 'application/octet-stream'), migratedBytes);
    return { contentType: String(legacy.contentType || 'application/octet-stream'), bytes: migratedBytes };
  } catch {
    return null;
  }
};

export const deleteRedisMedia = async (redis, env, name) => {
  await redis.del([mediaKey(env, name), mediaMetaKey(env, name)]);
};

export const listRedisMediaNames = async (redis, env) => {
  const prefix = buildKey(env, 'media:');
  const names = [];
  for await (const keys of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
    for (const key of keys) names.push(String(key).slice(prefix.length));
  }
  return names;
};
