import crypto from 'crypto';
import { buildCookie, clearCookie } from '../core/sessionCookie.js';
import { MEDIA_BODY_LIMIT_BYTES } from '../core/constants.js';
import { buildAdminCredentialsForSave, buildAdminCredentialsResponse } from '../core/credentialPolicy.js';
import { normalizeAuditEntry, normalizeAuditWritePayload } from '../core/auditContract.js';
import { parseMediaReferences } from '../core/mediaGc.js';
import {
  errorResponse,
  getClientIp,
  jsonResponse,
  methodNotAllowed,
  readBody,
  readBoundedInteger,
  readJsonObject
} from '../core/httpUtils.js';
import { isBlockedRemoteHost, safeFetchAgent } from '../core/remoteSecurity.js';
import { enforceSameOrigin } from '../core/requestOrigin.js';
import { getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';
import {
  buildPublicDataConflict,
  buildPublicDataWriteSuccess,
  preparePublicDataWrite
} from '../core/publicDataWrite.js';
import { hashPassword, normalizeMediaName, normalizePrivateDataPayload, timingSafeEqualText, verifyPasswordHash } from '../sharedSecurity.js';
import {
  appendRedisAudit,
  clearRedisSessions,
  consumeRateLimit,
  createRedisSession,
  deleteRedisKey,
  destroyRedisSession,
  getRedisClient,
  listRedisMediaNames,
  readRedisAudit,
  readRedisJson,
  readRedisMedia,
  saveRedisMedia,
  saveRedisPublicData,
  verifyRedisSession,
  writeRedisJson
} from './redisStore.js';
import { getSessionToken, requireRedisAuth } from './redisSession.js';

const REMOTE_USER_AGENT = 'anime-sa/1.0';

const checkRateLimit = async (response, redis, env, scope, limit, windowSeconds, clientIp) => {
  const result = await consumeRateLimit(redis, env, scope, clientIp, limit, windowSeconds);
  if (result.allowed) return true;
  response.setHeader('Retry-After', String(result.retryAfter));
  errorResponse(response, 429, 'Too many requests');
  return false;
};

const loadCredentials = async (redis, env) => {
  const stored = await readRedisJson(redis, env, 'private_data');
  if (stored?.username && (stored.passwordHash || stored.password)) return stored;
  const username = String(env.ADMIN_USERNAME || '').trim();
  const password = String(env.ADMIN_PASSWORD || '');
  if (!username || !password) return null;
  const credentials = { username, passwordHash: await hashPassword(password), passwordUpdatedAt: Date.now() };
  await writeRedisJson(redis, env, 'private_data', credentials);
  return credentials;
};

const appendAudit = async (redis, env, action, status, details = '', message = '') => {
  const normalized = normalizeAuditEntry({ action, status, details, message });
  await appendRedisAudit(redis, env, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    ...normalized
  });
};

const handleRemoteImage = async (request, response, url, redis, env) => {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!(await requireRedisAuth(request, response, redis, env))) return;
  const rawTarget = String(url.searchParams.get('url') || '').trim();
  if (!rawTarget) return errorResponse(response, 400, 'Missing url parameter');
  let target;
  try { target = new URL(rawTarget); } catch { return errorResponse(response, 400, 'Invalid remote image url'); }
  if (!['http:', 'https:'].includes(target.protocol)) return errorResponse(response, 400, 'Only http/https urls are allowed');
  if (isBlockedRemoteHost(target.hostname)) return errorResponse(response, 403, 'Remote host is not allowed');
  const upstream = await fetch(target.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': REMOTE_USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
    dispatcher: safeFetchAgent
  });
  let finalUrl = null;
  try { finalUrl = upstream.url ? new URL(upstream.url) : null; } catch {}
  if (finalUrl && isBlockedRemoteHost(finalUrl.hostname)) return errorResponse(response, 403, 'Redirected host is not allowed');
  if (!upstream.ok) return errorResponse(response, 502, `Remote fetch failed (${upstream.status})`);
  const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) return errorResponse(response, 415, 'Remote resource is not an image');
  const contentLength = Number(upstream.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MEDIA_BODY_LIMIT_BYTES) return errorResponse(response, 413, 'Remote image too large');
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > MEDIA_BODY_LIMIT_BYTES) return errorResponse(response, 413, 'Remote image too large');
  response.statusCode = 200;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Length', String(bytes.length));
  response.end(bytes);
};

const handleMedia = async (request, response, url, redis, env) => {
  const name = normalizeMediaName(url.searchParams.get('name'));
  if (!name) return errorResponse(response, 400, 'Invalid media name');
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST', 'DELETE']);
  }
  if (request.method === 'GET') {
    const media = await readRedisMedia(redis, env, name);
    if (!media) return errorResponse(response, 404, 'Media not found');
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Type', media.contentType);
    response.setHeader('Content-Length', String(media.bytes.length));
    response.end(media.bytes);
    return;
  }
  if (!(await requireRedisAuth(request, response, redis, env))) return;
  if (request.method === 'POST') {
    const bytes = await readBody(request, MEDIA_BODY_LIMIT_BYTES);
    await saveRedisMedia(redis, env, name, String(request.headers['content-type'] || 'application/octet-stream'), bytes);
    return jsonResponse(response, 200, { success: true, url: `/api/storage/media?name=${encodeURIComponent(name)}` });
  }
  if (request.method === 'DELETE') {
    await deleteRedisKey(redis, env, `media:${name}`);
    return jsonResponse(response, 200, { success: true });
  }
};

export const handleRedisStorageApi = async (request, response, { env, isProduction = true, runtime = 'vercel' }) => {
  if (!enforceSameOrigin(request, response)) return;
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'local'}`);
    const key = url.searchParams.get('key');
    const clientIp = getClientIp(request, env, runtime === 'vercel');
    if (key === 'driver') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { driver: 'redis' });
    }
    if (key === 'ping') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { ok: true, driver: 'redis', runtime });
    }

    const redis = await getRedisClient(env);
    if (!(await checkRateLimit(response, redis, env, 'api', 600, 60, clientIp))) return;
    if (url.pathname.endsWith('/remote-image')) return handleRemoteImage(request, response, url, redis, env);
    if (url.pathname.endsWith('/media')) return handleMedia(request, response, url, redis, env);

    if (url.pathname.endsWith('/login')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await checkRateLimit(response, redis, env, 'login', 20, 600, clientIp))) return;
      const parsedBody = await readJsonObject(request);
      if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
      const body = parsedBody.data;
      const credentials = await loadCredentials(redis, env);
      if (!credentials) return errorResponse(response, 503, '管理员账号未初始化');
      const usernameOk = timingSafeEqualText(body.username, credentials.username || '');
      const passwordOk = typeof credentials.passwordHash === 'string'
        ? await verifyPasswordHash(body.password, credentials.passwordHash)
        : timingSafeEqualText(body.password, credentials.password || '');
      if (!usernameOk || !passwordOk) {
        await appendAudit(redis, env, 'login', 'failed', `ip=${clientIp}`, 'Invalid credentials');
        return errorResponse(response, 401, 'Invalid credentials');
      }
      if (!credentials.passwordHash) {
        await writeRedisJson(redis, env, 'private_data', {
          username: credentials.username,
          passwordHash: await hashPassword(body.password),
          passwordUpdatedAt: Date.now()
        });
      }
      const session = await createRedisSession(redis, env, !!body.remember);
      await appendAudit(redis, env, 'login', 'success', `username=${credentials.username} ip=${clientIp}`);
      response.setHeader('Set-Cookie', buildCookie(session.token, session.maxAgeSec, isProduction));
      return jsonResponse(response, 200, { success: true, expiresAt: session.expiresAt });
    }

    if (url.pathname.endsWith('/logout')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      await destroyRedisSession(redis, env, getSessionToken(request));
      response.setHeader('Set-Cookie', clearCookie(isProduction));
      return jsonResponse(response, 200, { success: true });
    }
    if (url.pathname.endsWith('/session')) {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { authenticated: await verifyRedisSession(redis, env, getSessionToken(request)) });
    }

    if (url.pathname.endsWith('/transfer')) {
      if (!(await requireRedisAuth(request, response, redis, env))) return;
      if (request.method === 'GET') return jsonResponse(response, 200, { driver: 'redis', available: ['redis'] });
      return errorResponse(response, 501, 'Storage transfer requires the Node runtime');
    }

    if (url.pathname.endsWith('/admin-profile')) {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      if (!(await requireRedisAuth(request, response, redis, env))) return;
      const credentials = await loadCredentials(redis, env);
      if (!credentials) return errorResponse(response, 503, '管理员账号未初始化');
      return jsonResponse(response, 200, { username: credentials.username });
    }
    if (url.pathname.endsWith('/admin-credentials')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await requireRedisAuth(request, response, redis, env))) return;
      const parsedBody = await readJsonObject(request);
      if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
      const body = parsedBody.data;
      const current = await loadCredentials(redis, env);
      if (!current) return errorResponse(response, 503, '管理员账号未初始化');
      const next = await buildAdminCredentialsForSave(current, body);
      if (!next.data) return errorResponse(response, 400, next.error);
      await writeRedisJson(redis, env, 'private_data', next.data);
      await appendAudit(redis, env, 'update_admin_credentials', 'success', `source=redis changed=${next.changed ? '1' : '0'} ip=${clientIp}`);
      if (next.changed) {
        await clearRedisSessions(redis, env);
        response.setHeader('Set-Cookie', clearCookie(isProduction));
      }
      return jsonResponse(response, 200, buildAdminCredentialsResponse(next));
    }
    if (url.pathname.endsWith('/media-gc')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await requireRedisAuth(request, response, redis, env))) return;
      const limit = readBoundedInteger(url.searchParams.get('limit'), 100, 1, 500);
      const publicData = await readRedisJson(redis, env, 'public_data') || { cards: [] };
      const references = parseMediaReferences(publicData);
      const allNames = await listRedisMediaNames(redis, env);
      const removable = allNames.filter((name) => !references.has(name));
      const candidates = removable.slice(0, limit);
      for (const name of candidates) await deleteRedisKey(redis, env, `media:${name}`);
      const pending = Math.max(0, removable.length - candidates.length);
      await appendAudit(redis, env, 'run_media_gc', 'success', `driver=redis removed=${candidates.length} pending=${pending} ip=${clientIp}`);
      return jsonResponse(response, 200, { success: true, checked: allNames.length, removed: candidates.length, pending, hasMore: pending > 0 });
    }
    if (url.pathname.endsWith('/audit-logs')) {
      if (!(await requireRedisAuth(request, response, redis, env))) return;
      if (request.method === 'GET') {
        const limit = readBoundedInteger(url.searchParams.get('limit'), 50, 1, 200);
        return jsonResponse(response, 200, { items: await readRedisAudit(redis, env, limit) });
      }
      if (request.method === 'POST') {
        const parsedBody = await readJsonObject(request);
        if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
        const body = parsedBody.data;
        const normalized = normalizeAuditWritePayload(body);
        if (!normalized.data) return errorResponse(response, 400, normalized.error);
        await appendAudit(redis, env, normalized.data.action, normalized.data.status, normalized.data.details, normalized.data.message);
        return jsonResponse(response, 200, { success: true });
      }
      return methodNotAllowed(response, ['GET', 'POST']);
    }

    if (!key) return errorResponse(response, 400, 'Missing key parameter');
    if (!['public_data', 'private_data'].includes(key)) return errorResponse(response, 404, 'Unknown key');
    if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(response, ['GET', 'POST']);
    if (request.method === 'POST' || key === 'private_data') {
      if (!(await requireRedisAuth(request, response, redis, env))) return;
    }
    if (request.method === 'GET') {
      if (key === 'private_data') {
        const value = await readRedisJson(redis, env, key);
        return jsonResponse(response, 200, value ? {
          username: String(value.username || ''),
          passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : undefined,
          passwordUpdatedAt: value.passwordUpdatedAt
        } : null);
      }
      const value = await readRedisJson(redis, env, key);
      if (!value) return jsonResponse(response, 200, null);
      const normalized = normalizePublicDataPayload(value);
      return normalized ? jsonResponse(response, 200, normalized) : errorResponse(response, 500, 'Stored public_data is invalid');
    }
    if (request.method === 'POST') {
      const parsedBody = await readJsonObject(request);
      if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
      const body = parsedBody.data;
      if (key === 'private_data') {
        const normalized = normalizePrivateDataPayload(body);
        if (!normalized) return errorResponse(response, 400, 'Invalid private_data payload');
        await writeRedisJson(redis, env, key, normalized);
        await appendAudit(redis, env, 'write_private_data', 'success', `ip=${clientIp}`);
        return jsonResponse(response, 200, { success: true });
      }
      const prepared = preparePublicDataWrite(body, request.headers);
      if (!prepared.ok) return errorResponse(response, prepared.status, prepared.error);
      const result = await saveRedisPublicData(redis, env, prepared.data, prepared.expectedUpdatedAt);
      if (!result.success) return jsonResponse(response, 409, buildPublicDataConflict(result.currentUpdatedAt));
      await appendAudit(redis, env, 'write_public_data', 'success', `updatedAt=${getPublicDataUpdatedAt(prepared.data)} ip=${clientIp}`);
      return jsonResponse(response, 200, buildPublicDataWriteSuccess(prepared.data));
    }
    return methodNotAllowed(response, ['GET', 'POST']);
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') return errorResponse(response, 413, 'Payload too large');
    console.error('Redis storage API error:', error);
    return errorResponse(response, 500, 'Internal server error');
  }
};
