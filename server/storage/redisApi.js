import crypto from 'crypto';
import { createStorageApiHandler } from '../core/storageApiHandler.js';
import { buildCookie, clearCookie } from '../core/sessionCookie.js';
import { buildAdminCredentialsForSave, buildAdminCredentialsResponse } from '../core/credentialPolicy.js';
import { normalizeAuditEntry } from '../core/auditContract.js';
import { MEDIA_GC_GRACE_MS, parseMediaReferences } from '../core/mediaGc.js';
import { buildPublicDataMetrics } from '../core/dataMetrics.js';
import { hashPassword } from '../sharedSecurity.js';
import { appendRedisAudit, clearRedisSessions, consumeRateLimit, createRedisSession, deleteRedisMedia, destroyRedisSession, getRedisClient, listRedisMediaEntries, readRedisAudit, readRedisJson, readRedisMedia, saveRedisMedia, saveRedisPublicData, verifyRedisSession, writeRedisJson } from './redisStore.js';
import { getSessionToken, requireRedisAuth } from './redisSession.js';

const loadCredentials = async (redis, env) => {
  const stored = await readRedisJson(redis, env, 'private_data');
  if (stored?.username && (stored.passwordHash || stored.password)) return { creds: stored, source: 'redis' };
  const username = String(env.ADMIN_USERNAME || '').trim();
  const password = String(env.ADMIN_PASSWORD || '');
  if (!username || !password) return { error: '管理员账号未初始化' };
  const credentials = { username, passwordHash: await hashPassword(password), passwordUpdatedAt: Date.now() };
  await writeRedisJson(redis, env, 'private_data', credentials);
  return { creds: credentials, source: 'env' };
};

const createRedisHandler = (env, isProduction, runtime) => createStorageApiHandler({
  driver: 'redis',
  runtime,
  env,
  isProduction,
  getContext: () => getRedisClient(env),
  health: async () => { await (await getRedisClient(env)).ping(); },
  rateLimit: async (scope, clientIp, limit, windowSeconds) => consumeRateLimit(await getRedisClient(env), env, scope, clientIp, limit, windowSeconds),
  auth: {
    require: (request, response, redis) => requireRedisAuth(request, response, redis, env),
    getToken: getSessionToken,
    create: (redis, remember) => createRedisSession(redis, env, remember),
    verify: (redis, token) => verifyRedisSession(redis, env, token),
    destroy: (redis, token) => destroyRedisSession(redis, env, token),
    clear: (redis) => clearRedisSessions(redis, env),
    buildCookie,
    clearCookie
  },
  credentials: {
    load: (redis) => loadCredentials(redis, env),
    buildSave: buildAdminCredentialsForSave,
    buildResponse: buildAdminCredentialsResponse
  },
  data: {
    read: (redis, key) => readRedisJson(redis, env, key),
    write: (redis, key, value) => writeRedisJson(redis, env, key, value),
    savePublic: (redis, value, expectedRevision) => saveRedisPublicData(redis, env, value, expectedRevision),
    metrics: async (redis) => buildPublicDataMetrics(await readRedisJson(redis, env, 'public_data'))
  },
  media: {
    read: (redis, name) => readRedisMedia(redis, env, name),
    write: (redis, name, contentType, bytes) => saveRedisMedia(redis, env, name, contentType, bytes),
    delete: (redis, name) => deleteRedisMedia(redis, env, name),
    gc: async (redis, publicData, limit) => {
      const references = parseMediaReferences(publicData);
      const entries = await listRedisMediaEntries(redis, env);
      const unreferenced = entries.filter((entry) => !references.has(entry.name));
      const cutoff = Date.now() - MEDIA_GC_GRACE_MS;
      const removable = unreferenced.filter((entry) => entry.updatedAt <= cutoff);
      const candidates = removable.slice(0, limit);
      for (const entry of candidates) await deleteRedisMedia(redis, env, entry.name);
      return {
        checked: entries.length,
        removed: candidates.length,
        deferred: unreferenced.length - removable.length,
        pending: Math.max(0, removable.length - candidates.length),
        hasMore: removable.length > candidates.length
      };
    }
  },
  audit: {
    append: (entry, redis) => appendRedisAudit(redis, env, { id: crypto.randomUUID(), ts: Date.now(), ...normalizeAuditEntry(entry) }),
    read: (redis, limit) => readRedisAudit(redis, env, limit)
  }
});

export const handleRedisStorageApi = async (
  request,
  response,
  { env = process.env, isProduction = true, runtime = 'vercel' } = {}
) => createRedisHandler(env, isProduction, runtime)(request, response);
