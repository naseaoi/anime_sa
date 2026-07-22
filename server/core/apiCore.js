import { getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';
import {
  buildPublicDataConflict,
  buildPublicDataWriteSuccess,
  preparePublicDataWrite
} from './publicDataWrite.js';
import { BODY_LIMIT_BYTES, MEDIA_BODY_LIMIT_BYTES, SESSION_COOKIE } from './constants.js';
import { appendAuditLog } from './auditStore.js';
import { normalizeAuditWritePayload } from './auditContract.js';
import { dbDelete, dbGetJson, dbSetJson, ensureDb } from './kvStore.js';
import {
  getClientIp,
  jsonResponse,
  methodNotAllowed,
  parseCookies,
  readBody,
  readBoundedInteger,
  readJsonObject
} from './httpUtils.js';
import { isBlockedRemoteHost, safeFetchAgent } from './remoteSecurity.js';
import { enforceSameOrigin } from './requestOrigin.js';
import {
  buildAdminCredentialsForSave,
  buildAdminCredentialsResponse,
  ensureSqliteAdminFromEnv,
  resolveAdminCredentials
} from './adminCredentials.js';
import {
  cleanupSqliteUnusedMedia,
  collectSqliteMediaNames,
  parseMediaReferences
} from './mediaGc.js';
import {
  buildCookie,
  clearAllSessions,
  clearCookie,
  createSession,
  destroySession,
  requireAuth,
  verifySession
} from './sessionStore.js';
import {
  timingSafeEqualText,
  hashPassword,
  verifyPasswordHash,
  normalizeMediaName,
  normalizePrivateDataPayload
} from '../sharedSecurity.js';

export {
  BODY_LIMIT_BYTES,
  MEDIA_BODY_LIMIT_BYTES,
  SESSION_COOKIE,
  appendAuditLog,
  buildCookie,
  clearAllSessions,
  clearCookie,
  createSession,
  dbDelete,
  dbGetJson,
  dbSetJson,
  destroySession,
  ensureDb,
  getClientIp,
  isBlockedRemoteHost,
  jsonResponse,
  methodNotAllowed,
  parseCookies,
  readBody,
  readJsonObject,
  requireAuth,
  verifySession
};

export {
  buildAdminCredentialsForSave,
  cleanupSqliteUnusedMedia,
  collectSqliteMediaNames,
  ensureSqliteAdminFromEnv,
  parseMediaReferences,
  resolveAdminCredentials
};

// ===== 主存储 handler =====

export const handleStorageApi = async (req, res, { env, isProduction = false } = {}) => {
  if (!enforceSameOrigin(req, res)) return;
  const db = ensureDb();
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'local'}`);

    // /remote-image: 服务端代理外部图片（SSRF 防护 + 大小限制）
    if (url.pathname.endsWith('/remote-image')) {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      if (!requireAuth(req, res, db)) return;

      const rawTarget = String(url.searchParams.get('url') || '').trim();
      if (!rawTarget) return jsonResponse(res, 400, { error: 'Missing url parameter' });

      let target;
      try { target = new URL(rawTarget); } catch { return jsonResponse(res, 400, { error: 'Invalid remote image url' }); }
      if (!['http:', 'https:'].includes(target.protocol)) {
        return jsonResponse(res, 400, { error: 'Only http/https urls are allowed' });
      }
      if (isBlockedRemoteHost(target.hostname)) {
        return jsonResponse(res, 403, { error: 'Remote host is not allowed' });
      }

      const upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'anime-sa/1.0', Accept: 'image/*,*/*;q=0.8' },
        dispatcher: safeFetchAgent
      });

      let finalUrl = null;
      try { finalUrl = upstream.url ? new URL(upstream.url) : null; } catch { finalUrl = null; }
      if (finalUrl && isBlockedRemoteHost(finalUrl.hostname)) {
        return jsonResponse(res, 403, { error: 'Redirected host is not allowed' });
      }
      if (!upstream.ok) return jsonResponse(res, 502, { error: `Remote fetch failed (${upstream.status})` });

      const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!contentType.startsWith('image/')) {
        return jsonResponse(res, 415, { error: 'Remote resource is not an image' });
      }
      const contentLength = Number(upstream.headers.get('content-length') || '0');
      if (Number.isFinite(contentLength) && contentLength > MEDIA_BODY_LIMIT_BYTES) {
        return jsonResponse(res, 413, { error: 'Remote image too large' });
      }

      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.length > MEDIA_BODY_LIMIT_BYTES) {
        return jsonResponse(res, 413, { error: 'Remote image too large' });
      }

      res.statusCode = 200;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', bytes.length);
      res.end(bytes);
      return;
    }

    // /login
    if (url.pathname.endsWith('/login')) {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

      const parsedBody = await readJsonObject(req);
      if (!parsedBody.ok) return jsonResponse(res, 400, { success: false, error: parsedBody.error });
      const body = parsedBody.data;

      const { username, password, remember } = body;
      const resolved = await resolveAdminCredentials(db, env);
      if (!resolved.creds) {
        return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
      }

      const usernameOk = timingSafeEqualText(username, resolved.creds.username || '');
      const hash = resolved.creds.passwordHash;
      const legacyPlain = resolved.creds.password;
      const passwordOk = typeof hash === 'string'
        ? await verifyPasswordHash(password, hash)
        : timingSafeEqualText(password, legacyPlain || '');

      if (usernameOk && passwordOk) {
        // 明文凭据登录成功后自动升级为哈希
        if (!hash) {
          dbSetJson(db, 'private_data', {
            username: resolved.creds.username,
            passwordHash: await hashPassword(password),
            passwordUpdatedAt: Date.now()
          });
        }
        const session = createSession(db, !!remember);
        appendAuditLog(db, {
          action: 'login',
          status: 'success',
          details: `username=${resolved.creds.username} ip=${getClientIp(req, env)}`
        });
        res.setHeader('Set-Cookie', buildCookie(session.token, session.maxAgeSec, isProduction));
        return jsonResponse(res, 200, { success: true, expiresAt: session.expiresAt });
      }

      appendAuditLog(db, {
        action: 'login',
        status: 'failed',
        details: `ip=${getClientIp(req, env)}`,
        message: 'Invalid credentials'
      });
      return jsonResponse(res, 401, { success: false, error: 'Invalid credentials' });
    }

    // /logout
    if (url.pathname.endsWith('/logout')) {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const cookies = parseCookies(req.headers.cookie || '');
      destroySession(db, cookies[SESSION_COOKIE]);
      res.setHeader('Set-Cookie', clearCookie(isProduction));
      return jsonResponse(res, 200, { success: true });
    }

    // /session
    if (url.pathname.endsWith('/session')) {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      const cookies = parseCookies(req.headers.cookie || '');
      return jsonResponse(res, 200, { authenticated: verifySession(db, cookies[SESSION_COOKIE]) });
    }

    // /admin-profile
    if (url.pathname.endsWith('/admin-profile')) {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      if (!requireAuth(req, res, db)) return;
      const resolved = await resolveAdminCredentials(db, env);
      if (!resolved.creds) {
        return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
      }
      return jsonResponse(res, 200, { username: String(resolved.creds.username || '') });
    }

    // /audit-logs
    if (url.pathname.endsWith('/audit-logs')) {
      if (!requireAuth(req, res, db)) return;

      if (req.method === 'GET') {
        const limit = readBoundedInteger(url.searchParams.get('limit'), 50, 1, 200);
        const logs = dbGetJson(db, 'audit_logs');
        return jsonResponse(res, 200, { items: Array.isArray(logs) ? logs.slice(0, limit) : [] });
      }

      if (req.method === 'POST') {
        const parsedBody = await readJsonObject(req);
        if (!parsedBody.ok) return jsonResponse(res, 400, { success: false, error: parsedBody.error });
        const body = parsedBody.data;

        const normalized = normalizeAuditWritePayload(body);
        if (!normalized.data) return jsonResponse(res, 400, { success: false, error: normalized.error });

        appendAuditLog(db, normalized.data);
        return jsonResponse(res, 200, { success: true });
      }

      return methodNotAllowed(res, ['GET', 'POST']);
    }

    // /admin-credentials
    if (url.pathname.endsWith('/admin-credentials')) {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      if (!requireAuth(req, res, db)) return;

      const parsedBody = await readJsonObject(req);
      if (!parsedBody.ok) return jsonResponse(res, 400, { success: false, error: parsedBody.error });
      const body = parsedBody.data;

      const resolved = await resolveAdminCredentials(db, env);
      if (!resolved.creds) {
        return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
      }

      const next = await buildAdminCredentialsForSave(resolved.creds, body);
      if (!next.data) {
        return jsonResponse(res, 400, { success: false, error: next.error || '参数无效' });
      }

      dbSetJson(db, 'private_data', next.data);

      if (next.changed) clearAllSessions(db);

      appendAuditLog(db, {
        action: 'update_admin_credentials',
        status: 'success',
        details: `source=${resolved.source} changed=${next.changed ? '1' : '0'} ip=${getClientIp(req, env)}`
      });

      return jsonResponse(res, 200, buildAdminCredentialsResponse(next));
    }

    // /media-gc
    if (url.pathname.endsWith('/media-gc')) {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      if (!requireAuth(req, res, db)) return;

      const limit = readBoundedInteger(url.searchParams.get('limit'), 100, 1, 500);

      try {
        const data = dbGetJson(db, 'public_data') || { cards: [] };
        const result = cleanupSqliteUnusedMedia(db, parseMediaReferences(data), limit);
        appendAuditLog(db, {
          action: 'run_media_gc',
          status: 'success',
          details: `driver=sqlite removed=${result.removed} pending=${result.pending} ip=${getClientIp(req, env)}`
        });
        return jsonResponse(res, 200, { success: true, ...result });
      } catch {
        appendAuditLog(db, {
          action: 'run_media_gc',
          status: 'failed',
          details: `driver=sqlite ip=${getClientIp(req, env)}`,
          message: '封面资源清理失败'
        });
        return jsonResponse(res, 500, { success: false, error: '封面资源清理失败' });
      }
    }

    // /media
    if (url.pathname.endsWith('/media')) {
      const mediaName = normalizeMediaName(url.searchParams.get('name'));
      if (!mediaName) return jsonResponse(res, 400, { error: 'Invalid media name' });

      const mediaKey = `media:${mediaName}`;
      if (req.method === 'GET') {
        const media = dbGetJson(db, mediaKey);
        if (!media?.base64) return jsonResponse(res, 404, { error: 'Media not found' });
        const bytes = Buffer.from(media.base64, 'base64');
        res.statusCode = 200;
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', String(media.contentType || 'application/octet-stream'));
        res.setHeader('Content-Length', bytes.length);
        res.end(bytes);
        return;
      }

      if (req.method === 'POST') {
        if (!requireAuth(req, res, db)) return;
        const rawBody = await readBody(req, MEDIA_BODY_LIMIT_BYTES);
        dbSetJson(db, mediaKey, {
          contentType: String(req.headers['content-type'] || 'application/octet-stream'),
          base64: rawBody.toString('base64'),
          updatedAt: Date.now()
        });
        return jsonResponse(res, 200, { success: true, url: `/api/storage/media?name=${encodeURIComponent(mediaName)}` });
      }

      if (req.method === 'DELETE') {
        if (!requireAuth(req, res, db)) return;
        dbDelete(db, mediaKey);
        return jsonResponse(res, 200, { success: true });
      }

      return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }

    // 通用 KV：GET/POST
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse(res, 400, { success: false, error: 'Missing key parameter' });

    if (key === 'driver') {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      return jsonResponse(res, 200, { driver: 'sqlite' });
    }
    if (key === 'ping') {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      return jsonResponse(res, 200, { ok: true, driver: 'sqlite', runtime: 'node' });
    }
    const publicReadKeys = new Set(['public_data']);
    const writableKeys = new Set(['public_data', 'private_data']);
    if (req.method === 'GET' && key !== 'private_data' && !publicReadKeys.has(key)) {
      return jsonResponse(res, 404, { success: false, error: 'Unknown key' });
    }
    if (req.method === 'POST' && !writableKeys.has(key)) {
      return jsonResponse(res, 404, { success: false, error: 'Unknown key' });
    }

    const isWrite = req.method === 'POST';
    const isPrivateRead = req.method === 'GET' && key === 'private_data';
    if ((isWrite || isPrivateRead) && !requireAuth(req, res, db)) return;

    if (req.method === 'GET') {
      const value = dbGetJson(db, key);
      // private_data 脱敏：永远不向客户端返回明文 password 字段，只暴露 hash + 更新时间
      if (key === 'private_data' && value && typeof value === 'object') {
        return jsonResponse(res, 200, {
          username: String(value.username || ''),
          passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : undefined,
          passwordUpdatedAt: value.passwordUpdatedAt
        });
      }
      if (key === 'public_data' && value) {
        const normalized = normalizePublicDataPayload(value);
        if (!normalized) return jsonResponse(res, 500, { error: 'Stored public_data is invalid' });
        return jsonResponse(res, 200, normalized);
      }
      return jsonResponse(res, 200, value || null);
    }

    if (req.method === 'POST') {
      const parsedBody = await readJsonObject(req);
      if (!parsedBody.ok) return jsonResponse(res, 400, { success: false, error: parsedBody.error });
      const parsed = parsedBody.data;

      if (key === 'private_data') {
        const normalized = normalizePrivateDataPayload(parsed);
        if (!normalized) return jsonResponse(res, 400, { error: 'Invalid private_data payload' });
        const privateData = {
          username: normalized.username,
          passwordHash: normalized.passwordHash,
          passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
        };
        dbSetJson(db, key, privateData);
        appendAuditLog(db, { action: 'write_private_data', status: 'success', details: `ip=${getClientIp(req, env)}` });
        return jsonResponse(res, 200, { success: true });
      }

      if (key === 'public_data') {
        const prepared = preparePublicDataWrite(parsed, req.headers);
        if (!prepared.ok) return jsonResponse(res, prepared.status, { error: prepared.error });

        if (prepared.expectedUpdatedAt !== undefined) {
          const currentUpdatedAt = getPublicDataUpdatedAt(dbGetJson(db, key));
          if (currentUpdatedAt !== prepared.expectedUpdatedAt) {
            return jsonResponse(res, 409, buildPublicDataConflict(currentUpdatedAt));
          }
        }

        dbSetJson(db, key, prepared.data);
        appendAuditLog(db, { action: 'write_public_data', status: 'success', details: `ip=${getClientIp(req, env)}` });
        return jsonResponse(res, 200, buildPublicDataWriteSuccess(prepared.data));
      }
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (e) {
    if (e.code === 'PAYLOAD_TOO_LARGE') {
      return jsonResponse(res, 413, { success: false, error: 'Payload too large' });
    }
    console.error('SQLite API Error:', e);
    return jsonResponse(res, 500, { success: false, error: 'Internal server error' });
  }
};
