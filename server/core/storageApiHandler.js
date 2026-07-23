import { MEDIA_BODY_LIMIT_BYTES, SESSION_COOKIE } from './constants.js';
import { normalizeAuditWritePayload } from './auditContract.js';
import {
  buildPublicDataConflict,
  buildPublicDataWriteSuccess,
  preparePublicDataWrite
} from './publicDataWrite.js';
import {
  errorResponse,
  getClientIp,
  jsonResponse,
  methodNotAllowed,
  readBody,
  readBoundedInteger,
  readJsonObject
} from './httpUtils.js';
import { isBlockedRemoteHost, safeFetchAgent } from './remoteSecurity.js';
import { enforceSameOrigin } from './requestOrigin.js';
import {
  hashPassword,
  normalizeMediaName,
  normalizePrivateDataPayload,
  timingSafeEqualText,
  verifyPasswordHash
} from '../sharedSecurity.js';
import { getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';

const REMOTE_USER_AGENT = 'anime-sa/1.0';

/** @typedef {{ allowed: boolean, retryAfter?: number }} RateLimitResult */
/** @typedef {(scope: string, clientIp: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>} RateLimitFn */

const writeRemoteImage = async (request, response, url, requireAuth) => {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!(await requireAuth(request, response))) return;

  const rawTarget = String(url.searchParams.get('url') || '').trim();
  if (!rawTarget) return errorResponse(response, 400, 'Missing url parameter');

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    return errorResponse(response, 400, 'Invalid remote image url');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return errorResponse(response, 400, 'Only http/https urls are allowed');
  }
  if (isBlockedRemoteHost(target.hostname)) {
    return errorResponse(response, 403, 'Remote host is not allowed');
  }

  const upstream = await fetch(target.toString(), /** @type {RequestInit & { dispatcher: unknown }} */ ({
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': REMOTE_USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
    dispatcher: safeFetchAgent
  }));

  let finalUrl = null;
  try {
    finalUrl = upstream.url ? new URL(upstream.url) : null;
  } catch {}
  if (finalUrl && isBlockedRemoteHost(finalUrl.hostname)) {
    return errorResponse(response, 403, 'Redirected host is not allowed');
  }
  if (!upstream.ok) return errorResponse(response, 502, `Remote fetch failed (${upstream.status})`);

  const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    return errorResponse(response, 415, 'Remote resource is not an image');
  }
  const contentLength = Number(upstream.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MEDIA_BODY_LIMIT_BYTES) {
    return errorResponse(response, 413, 'Remote image too large');
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > MEDIA_BODY_LIMIT_BYTES) {
    return errorResponse(response, 413, 'Remote image too large');
  }

  response.statusCode = 200;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Length', bytes.length);
  response.end(bytes);
};

const buildPrivateDataResponse = (value) => {
  if (!value || typeof value !== 'object') return null;
  return {
    username: String(value.username || ''),
    passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : undefined,
    passwordUpdatedAt: value.passwordUpdatedAt
  };
};

const checkRateLimit = async (response, rateLimit, scope, clientIp, limit, windowSeconds) => {
  if (!rateLimit) return true;
  const result = await rateLimit(scope, clientIp, limit, windowSeconds);
  if (result.allowed) return true;
  response.setHeader('Retry-After', String(result.retryAfter || 1));
  errorResponse(response, 429, 'Too many requests', { retryAfterSec: result.retryAfter || 1 });
  return false;
};

export const createStorageApiHandler = ({
  driver,
  runtime = 'node',
  env = process.env,
  isProduction = false,
  getContext,
  rateLimit = /** @type {RateLimitFn|null} */ (null),
  auth,
  credentials,
  data,
  media,
  audit,
  availableDrivers = [driver],
  health
}) => async (request, response) => {
  if (!enforceSameOrigin(request, response)) return;

  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'local'}`);
    const key = url.searchParams.get('key');
    const clientIp = getClientIp(request, env, runtime === 'vercel');

    if (key === 'driver') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { driver });
    }
    if (key === 'ping') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { ok: true, driver, runtime });
    }
    if (key === 'ready') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      if (!health) return jsonResponse(response, 200, { ok: true, driver, runtime });
      try {
        await health();
        return jsonResponse(response, 200, { ok: true, driver, runtime });
      } catch {
        return errorResponse(response, 503, 'Storage is not ready');
      }
    }

    const context = await getContext();
    if (!(await checkRateLimit(response, rateLimit, 'api', clientIp, 600, 60))) return;

    if (url.pathname.endsWith('/remote-image')) {
      return writeRemoteImage(request, response, url, (req, res) => auth.require(req, res, context));
    }

    if (url.pathname.endsWith('/media')) {
      const name = normalizeMediaName(url.searchParams.get('name'));
      if (!name) return errorResponse(response, 400, 'Invalid media name');
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
        return methodNotAllowed(response, ['GET', 'POST', 'DELETE']);
      }
      if (request.method === 'GET') {
        const item = await media.read(context, name);
        if (!item) return errorResponse(response, 404, 'Media not found');
        response.statusCode = 200;
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        response.setHeader('Content-Type', item.contentType);
        response.setHeader('Content-Length', item.bytes.length);
        response.end(item.bytes);
        return;
      }
      if (!(await auth.require(request, response, context))) return;
      if (request.method === 'POST') {
        const bytes = await readBody(request, MEDIA_BODY_LIMIT_BYTES);
        await media.write(context, name, String(request.headers['content-type'] || 'application/octet-stream'), bytes);
        return jsonResponse(response, 200, { success: true, url: `/api/storage/media?name=${encodeURIComponent(name)}` });
      }
      await media.delete(context, name);
      return jsonResponse(response, 200, { success: true });
    }

    if (url.pathname.endsWith('/login')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await checkRateLimit(response, rateLimit, 'login', clientIp, 20, 600))) return;
      const parsedBody = await readJsonObject(request);
      if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
      const body = parsedBody.data;
      const resolved = await credentials.load(context);
      if (!resolved?.creds) return errorResponse(response, 503, resolved?.error || '管理员账号不可用');

      const usernameOk = timingSafeEqualText(body.username, resolved.creds.username || '');
      const passwordOk = typeof resolved.creds.passwordHash === 'string'
        ? await verifyPasswordHash(body.password, resolved.creds.passwordHash)
        : timingSafeEqualText(body.password, resolved.creds.password || '');

      if (!usernameOk || !passwordOk) {
        await audit.append({ action: 'login', status: 'failed', details: `ip=${clientIp}`, message: 'Invalid credentials' }, context);
        return errorResponse(response, 401, 'Invalid credentials');
      }

      if (!resolved.creds.passwordHash) {
        await data.write(context, 'private_data', {
          username: resolved.creds.username,
          passwordHash: await hashPassword(body.password),
          passwordUpdatedAt: Date.now()
        });
      }
      const session = await auth.create(context, !!body.remember);
      await audit.append({ action: 'login', status: 'success', details: `username=${resolved.creds.username} ip=${clientIp}` }, context);
      response.setHeader('Set-Cookie', auth.buildCookie(session.token, session.maxAgeSec, isProduction));
      return jsonResponse(response, 200, { success: true, expiresAt: session.expiresAt });
    }

    if (url.pathname.endsWith('/logout')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      await auth.destroy(context, auth.getToken(request));
      response.setHeader('Set-Cookie', auth.clearCookie(isProduction));
      return jsonResponse(response, 200, { success: true });
    }

    if (url.pathname.endsWith('/session')) {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      return jsonResponse(response, 200, { authenticated: await auth.verify(context, auth.getToken(request)) });
    }

    if (url.pathname.endsWith('/transfer')) {
      if (!(await auth.require(request, response, context))) return;
      if (request.method === 'GET') return jsonResponse(response, 200, { driver, available: availableDrivers });
      return errorResponse(response, 501, 'Storage transfer requires the Node runtime');
    }

    if (url.pathname.endsWith('/data-metrics')) {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      if (!(await auth.require(request, response, context))) return;
      if (!data.metrics) return errorResponse(response, 501, 'Data metrics are not available');
      return jsonResponse(response, 200, await data.metrics(context));
    }

    if (url.pathname.endsWith('/admin-profile')) {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      if (!(await auth.require(request, response, context))) return;
      const resolved = await credentials.load(context);
      if (!resolved?.creds) return errorResponse(response, 503, resolved?.error || '管理员账号不可用');
      return jsonResponse(response, 200, { username: String(resolved.creds.username || '') });
    }

    if (url.pathname.endsWith('/admin-credentials')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await auth.require(request, response, context))) return;
      const parsedBody = await readJsonObject(request);
      if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
      const current = await credentials.load(context);
      if (!current?.creds) return errorResponse(response, 503, current?.error || '管理员账号不可用');
      const next = await credentials.buildSave(current.creds, parsedBody.data);
      if (!next.data) return errorResponse(response, 400, next.error || '参数无效');
      await data.write(context, 'private_data', next.data);
      if (next.changed) await auth.clear(context);
      await audit.append({
        action: 'update_admin_credentials',
        status: 'success',
        details: `source=${current.source} changed=${next.changed ? '1' : '0'} ip=${clientIp}`
      }, context);
      if (next.changed) response.setHeader('Set-Cookie', auth.clearCookie(isProduction));
      return jsonResponse(response, 200, credentials.buildResponse(next));
    }

    if (url.pathname.endsWith('/media-gc')) {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!(await auth.require(request, response, context))) return;
      const limit = readBoundedInteger(url.searchParams.get('limit'), 100, 1, 500);
      try {
        const publicData = await data.read(context, 'public_data') || { cards: [] };
        const result = await media.gc(context, publicData, limit);
        await audit.append({ action: 'run_media_gc', status: 'success', details: `driver=${driver} removed=${result.removed} pending=${result.pending} ip=${clientIp}` }, context);
        return jsonResponse(response, 200, { success: true, ...result });
      } catch {
        await audit.append({ action: 'run_media_gc', status: 'failed', details: `driver=${driver} ip=${clientIp}`, message: '封面资源清理失败' }, context);
        return errorResponse(response, 500, '封面资源清理失败');
      }
    }

    if (url.pathname.endsWith('/audit-logs')) {
      if (!(await auth.require(request, response, context))) return;
      if (request.method === 'GET') {
        const limit = readBoundedInteger(url.searchParams.get('limit'), 50, 1, 200);
        return jsonResponse(response, 200, { items: await audit.read(context, limit) });
      }
      if (request.method === 'POST') {
        const parsedBody = await readJsonObject(request);
        if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
        const normalized = normalizeAuditWritePayload(parsedBody.data);
        if (!normalized.data) return errorResponse(response, 400, normalized.error);
        await audit.append(normalized.data, context);
        return jsonResponse(response, 200, { success: true });
      }
      return methodNotAllowed(response, ['GET', 'POST']);
    }

    if (!key) return errorResponse(response, 400, 'Missing key parameter');
    if (!['public_data', 'private_data'].includes(key)) return errorResponse(response, 404, 'Unknown key');
    if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(response, ['GET', 'POST']);
    if (request.method === 'POST' || key === 'private_data') {
      if (!(await auth.require(request, response, context))) return;
    }

    if (request.method === 'GET') {
      const value = await data.read(context, key);
      if (key === 'private_data') return jsonResponse(response, 200, buildPrivateDataResponse(value));
      if (!value) return jsonResponse(response, 200, null);
      const normalized = normalizePublicDataPayload(value);
      return normalized ? jsonResponse(response, 200, normalized) : errorResponse(response, 500, 'Stored public_data is invalid');
    }

    const parsedBody = await readJsonObject(request);
    if (!parsedBody.ok) return errorResponse(response, 400, parsedBody.error);
    if (key === 'private_data') {
      const normalized = normalizePrivateDataPayload(parsedBody.data);
      if (!normalized) return errorResponse(response, 400, 'Invalid private_data payload');
      await data.write(context, key, normalized);
      await audit.append({ action: 'write_private_data', status: 'success', details: `ip=${clientIp}` }, context);
      return jsonResponse(response, 200, { success: true });
    }

    const prepared = preparePublicDataWrite(parsedBody.data, request.headers);
    if (!prepared.ok) return errorResponse(response, prepared.status, prepared.error);
    const result = await data.savePublic(context, prepared.data, prepared.expectedUpdatedAt);
    if (!result.success) return jsonResponse(response, 409, buildPublicDataConflict(result.currentUpdatedAt));
    await audit.append({ action: 'write_public_data', status: 'success', details: `updatedAt=${getPublicDataUpdatedAt(prepared.data)} ip=${clientIp}` }, context);
    return jsonResponse(response, 200, buildPublicDataWriteSuccess(prepared.data));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'PAYLOAD_TOO_LARGE') {
      return errorResponse(response, 413, 'Payload too large');
    }
    console.error(`${driver} storage API error:`, error);
    return errorResponse(response, 500, 'Internal server error');
  }
};

export { SESSION_COOKIE };
