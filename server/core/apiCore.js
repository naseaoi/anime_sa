import { getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';
import { BODY_LIMIT_BYTES, MEDIA_BODY_LIMIT_BYTES, SESSION_COOKIE } from './constants.js';
import { appendAuditLog, cleanAuditText } from './auditStore.js';
import { dbDelete, dbGetJson, dbSetJson, ensureDb, getStorageMode } from './kvStore.js';
import { getClientIp, jsonResponse, parseCookies, readBody } from './httpUtils.js';
import { isBlockedRemoteHost, safeFetchAgent } from './remoteSecurity.js';
import { enforceSameOrigin } from './requestOrigin.js';
import {
  buildAdminCredentialsForSave,
  buildPrivateDataForTarget,
  ensureSqliteAdminFromEnv,
  resolveAdminCredentials
} from './adminCredentials.js';
import {
  cleanupSqliteUnusedMedia,
  cleanupWebDavUnusedMedia,
  collectSqliteMediaNames,
  parseCoverReferenceSets
} from './mediaGc.js';
import {
  buildWebDavUrl,
  deleteWebDavCoverFile,
  fetchWebDavJson,
  getWebDavAuthHeader,
  getWebDavConfig,
  listWebDavCoverNames,
  saveWebDavJson,
  WEBDAV_USER_AGENT
} from './webdavStore.js';
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
  normalizeWebDavFilename,
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
  getStorageMode,
  isBlockedRemoteHost,
  jsonResponse,
  parseCookies,
  readBody,
  requireAuth,
  verifySession
};

export {
  buildAdminCredentialsForSave,
  buildPrivateDataForTarget,
  buildWebDavUrl,
  cleanupSqliteUnusedMedia,
  cleanupWebDavUnusedMedia,
  collectSqliteMediaNames,
  deleteWebDavCoverFile,
  ensureSqliteAdminFromEnv,
  fetchWebDavJson,
  getWebDavConfig,
  listWebDavCoverNames,
  parseCoverReferenceSets,
  resolveAdminCredentials,
  saveWebDavJson
};

// ===== 主 handler：WebDAV 代理 =====

export const handleWebDavApi = async (req, res, { env }) => {
  if (!enforceSameOrigin(req, res)) return;
  const db = ensureDb();
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'local'}`);
    const filename = normalizeWebDavFilename(url.searchParams.get('filename'));
    if (filename === null) {
      return jsonResponse(res, 400, { error: 'Invalid WebDAV filename' });
    }
    const config = getWebDavConfig(env);
    if (!config) {
      return jsonResponse(res, 500, { error: 'Missing WebDAV configuration in environment variables' });
    }

    const tunneled = req.headers['x-dav-method'];
    const methodRaw = Array.isArray(tunneled) ? tunneled[0] : (tunneled || req.method || 'GET');
    const method = String(methodRaw).toUpperCase();
    const mutating = new Set(['PUT', 'DELETE', 'MKCOL', 'PROPPATCH', 'MOVE', 'COPY', 'LOCK', 'UNLOCK']);
    const needsAuth = filename === 'private_data.json' || mutating.has(method);
    if (needsAuth && !requireAuth(req, res, db)) return;

    const headers = {
      Authorization: getWebDavAuthHeader(config),
      'User-Agent': WEBDAV_USER_AGENT
    };
    if (req.headers.depth) headers.Depth = req.headers.depth;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers['if-match']) headers['If-Match'] = req.headers['if-match'];
    if (req.headers['if-none-match']) headers['If-None-Match'] = req.headers['if-none-match'];

    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      const rawBody = await readBody(req, MEDIA_BODY_LIMIT_BYTES);
      if (method === 'PUT' && filename === 'public_data.json') {
        let parsed;
        try { parsed = JSON.parse(rawBody.toString() || '{}'); }
        catch { return jsonResponse(res, 400, { error: 'Invalid JSON body' }); }
        const normalized = normalizePublicDataPayload(parsed);
        if (!normalized) return jsonResponse(res, 400, { error: 'Invalid public_data payload' });
        body = new Uint8Array(Buffer.from(JSON.stringify(normalized)));
      } else if (method === 'PUT' && filename === 'private_data.json') {
        let parsed;
        try { parsed = JSON.parse(rawBody.toString() || '{}'); }
        catch { return jsonResponse(res, 400, { error: 'Invalid JSON body' }); }
        const normalized = normalizePrivateDataPayload(parsed);
        if (!normalized) return jsonResponse(res, 400, { error: 'Invalid private_data payload' });
        body = new Uint8Array(Buffer.from(JSON.stringify(normalized)));
      } else {
        body = rawBody.length > 0 ? new Uint8Array(rawBody) : null;
      }
    }

    const davResponse = await fetch(buildWebDavUrl(env, filename), { method, headers, body });
    res.statusCode = davResponse.status;
    const contentType = davResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const etag = davResponse.headers.get('etag');
    if (etag) res.setHeader('ETag', etag);
    const lastModified = davResponse.headers.get('last-modified');
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    const arrayBuffer = await davResponse.arrayBuffer();
    const responseBody = Buffer.from(arrayBuffer);
    if (method === 'GET' && filename === 'public_data.json' && davResponse.ok) {
      let parsed;
      try { parsed = JSON.parse(responseBody.toString() || '{}'); }
      catch { return jsonResponse(res, 502, { error: 'Stored WebDAV public_data is invalid' }); }
      const normalized = normalizePublicDataPayload(parsed);
      if (!normalized) return jsonResponse(res, 502, { error: 'Stored WebDAV public_data is invalid' });
      return res.end(JSON.stringify(normalized));
    }
    res.end(responseBody);
  } catch (e) {
    if (e.code === 'PAYLOAD_TOO_LARGE') {
      return jsonResponse(res, 413, { error: 'Payload too large' });
    }
    console.error('WebDAV Proxy Error:', e);
    return jsonResponse(res, 500, { error: e.message });
  }
};

// ===== 主 handler：/api/sqlite/* =====

export const handleSqliteApi = async (req, res, { env, isProduction = false } = {}) => {
  if (!enforceSameOrigin(req, res)) return;
  const db = ensureDb();
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'local'}`);

    // /remote-image: 服务端代理外部图片（SSRF 防护 + 大小限制）
    if (url.pathname.endsWith('/remote-image')) {
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
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
        headers: { 'User-Agent': WEBDAV_USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
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
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

      const rawBody = await readBody(req);
      let body;
      try { body = JSON.parse(rawBody.toString() || '{}'); }
      catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

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
        if (!hash && resolved.source === 'sqlite') {
          dbSetJson(db, 'private_data', {
            username: resolved.creds.username,
            passwordHash: await hashPassword(password),
            passwordUpdatedAt: Date.now()
          });
        }
        if (!hash && resolved.source === 'webdav') {
          const upgradedHash = await hashPassword(password);
          saveWebDavJson(env, 'private_data.json', {
            username: resolved.creds.username,
            passwordHash: upgradedHash,
            passwordUpdatedAt: Date.now()
          }).catch(() => {});
        }
        const session = createSession(db, !!remember);
        res.setHeader('Set-Cookie', buildCookie(session.token, session.maxAgeSec, isProduction));
        return jsonResponse(res, 200, { success: true, expiresAt: session.expiresAt });
      }

      return jsonResponse(res, 401, { success: false, error: 'Invalid credentials' });
    }

    // /logout
    if (url.pathname.endsWith('/logout')) {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      const cookies = parseCookies(req.headers.cookie || '');
      destroySession(db, cookies[SESSION_COOKIE]);
      res.setHeader('Set-Cookie', clearCookie(isProduction));
      return jsonResponse(res, 200, { success: true });
    }

    // /session
    if (url.pathname.endsWith('/session')) {
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
      const cookies = parseCookies(req.headers.cookie || '');
      return jsonResponse(res, 200, { authenticated: verifySession(db, cookies[SESSION_COOKIE]) });
    }

    // /admin-profile
    if (url.pathname.endsWith('/admin-profile')) {
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
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
        const limitRaw = Number(url.searchParams.get('limit') || 50);
        const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
        const logs = dbGetJson(db, 'audit_logs');
        return jsonResponse(res, 200, { items: Array.isArray(logs) ? logs.slice(0, limit) : [] });
      }

      if (req.method === 'POST') {
        const rawBody = await readBody(req);
        let body;
        try { body = JSON.parse(rawBody.toString() || '{}'); }
        catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

        const action = cleanAuditText(body?.action, 64);
        if (!/^[a-z0-9_:-]+$/i.test(action)) {
          return jsonResponse(res, 400, { success: false, error: 'Invalid action' });
        }

        appendAuditLog(db, {
          action,
          status: body?.status === 'failed' ? 'failed' : 'success',
          details: cleanAuditText(body?.details, 300),
          message: cleanAuditText(body?.message, 800)
        });
        return jsonResponse(res, 200, { success: true });
      }

      res.statusCode = 405;
      res.end();
      return;
    }

    // /admin-credentials
    if (url.pathname.endsWith('/admin-credentials')) {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      if (!requireAuth(req, res, db)) return;

      const rawBody = await readBody(req);
      let body;
      try { body = JSON.parse(rawBody.toString() || '{}'); }
      catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

      const resolved = await resolveAdminCredentials(db, env);
      if (!resolved.creds) {
        return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
      }

      const next = await buildAdminCredentialsForSave(resolved.creds, body);
      if (!next.data) {
        return jsonResponse(res, 400, { success: false, error: next.error || '参数无效' });
      }

      if (resolved.source === 'webdav') {
        try {
          await saveWebDavJson(env, 'private_data.json', next.data);
        } catch {
          appendAuditLog(db, {
            action: 'update_admin_credentials',
            status: 'failed',
            details: `source=webdav ip=${getClientIp(req)}`,
            message: 'WebDAV 凭据写入失败'
          });
          return jsonResponse(res, 500, { success: false, error: 'WebDAV 凭据写入失败' });
        }
      } else {
        dbSetJson(db, 'private_data', next.data);
      }

      if (next.changed) clearAllSessions(db);

      appendAuditLog(db, {
        action: 'update_admin_credentials',
        status: 'success',
        details: `source=${resolved.source} changed=${next.changed ? '1' : '0'} ip=${getClientIp(req)}`
      });

      return jsonResponse(res, 200, {
        success: true,
        username: next.data.username,
        passwordChanged: next.passwordChanged,
        requireRelogin: !!next.changed
      });
    }

    // /admin-credentials-sync
    if (url.pathname.endsWith('/admin-credentials-sync')) {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      if (!requireAuth(req, res, db)) return;

      const target = url.searchParams.get('target');
      if (target !== 'sqlite' && target !== 'webdav') {
        return jsonResponse(res, 400, { success: false, error: 'Invalid target' });
      }

      const rawBody = await readBody(req);
      let body;
      try { body = JSON.parse(rawBody.toString() || '{}'); }
      catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

      const next = await buildPrivateDataForTarget(body);
      if (!next.data) {
        return jsonResponse(res, 400, { success: false, error: next.error || '参数无效' });
      }

      if (target === 'webdav') {
        try {
          await saveWebDavJson(env, 'private_data.json', next.data);
        } catch {
          appendAuditLog(db, {
            action: 'sync_admin_credentials',
            status: 'failed',
            details: `target=webdav ip=${getClientIp(req)}`,
            message: 'WebDAV 凭据写入失败'
          });
          return jsonResponse(res, 500, { success: false, error: 'WebDAV 凭据写入失败' });
        }
      } else {
        dbSetJson(db, 'private_data', next.data);
      }

      appendAuditLog(db, {
        action: 'sync_admin_credentials',
        status: 'success',
        details: `target=${target} ip=${getClientIp(req)}`
      });
      return jsonResponse(res, 200, { success: true });
    }

    // /media-gc
    if (url.pathname.endsWith('/media-gc')) {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      if (!requireAuth(req, res, db)) return;

      const target = url.searchParams.get('target');
      if (target !== 'sqlite' && target !== 'webdav') {
        return jsonResponse(res, 400, { success: false, error: 'Invalid target' });
      }
      const limitRaw = Number(url.searchParams.get('limit') || 100);
      const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));

      try {
        if (target === 'sqlite') {
          const sqliteData = dbGetJson(db, 'public_data') || { cards: [] };
          const refs = parseCoverReferenceSets(sqliteData);
          const result = cleanupSqliteUnusedMedia(db, refs.sqliteNames, limit);
          appendAuditLog(db, {
            action: 'run_media_gc',
            status: 'success',
            details: `target=sqlite removed=${result.removed} pending=${result.pending} ip=${getClientIp(req)}`
          });
          return jsonResponse(res, 200, { success: true, ...result });
        }

        const webdavData = await fetchWebDavJson(env, 'public_data.json').catch(() => null);
        const refs = parseCoverReferenceSets(webdavData || { cards: [] });
        const result = await cleanupWebDavUnusedMedia(env, refs.webdavNames, limit);
        appendAuditLog(db, {
          action: 'run_media_gc',
          status: 'success',
          details: `target=webdav removed=${result.removed} pending=${result.pending} ip=${getClientIp(req)}`
        });
        return jsonResponse(res, 200, { success: true, ...result });
      } catch {
        appendAuditLog(db, {
          action: 'run_media_gc',
          status: 'failed',
          details: `target=${target} ip=${getClientIp(req)}`,
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
        return jsonResponse(res, 200, { success: true, url: `/api/sqlite/media?name=${encodeURIComponent(mediaName)}` });
      }

      if (req.method === 'DELETE') {
        if (!requireAuth(req, res, db)) return;
        dbDelete(db, mediaKey);
        return jsonResponse(res, 200, { success: true });
      }

      res.statusCode = 405;
      res.end();
      return;
    }

    // 通用 KV：GET/POST
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse(res, 400, { error: 'Missing key parameter' });

    const publicReadKeys = new Set(['public_data', 'storage_mode', 'ping']);
    const writableKeys = new Set(['public_data', 'private_data', 'storage_mode']);
    if (req.method === 'GET' && key !== 'private_data' && !publicReadKeys.has(key)) {
      return jsonResponse(res, 404, { error: 'Unknown key' });
    }
    if (req.method === 'POST' && !writableKeys.has(key)) {
      return jsonResponse(res, 404, { error: 'Unknown key' });
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
      const rawBody = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(rawBody.toString() || '{}'); }
      catch { return jsonResponse(res, 400, { error: 'Invalid JSON body' }); }

      if (key === 'private_data') {
        const normalized = normalizePrivateDataPayload(parsed);
        if (!normalized) return jsonResponse(res, 400, { error: 'Invalid private_data payload' });
        const privateData = {
          username: normalized.username,
          passwordHash: normalized.passwordHash,
          passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
        };
        dbSetJson(db, key, privateData);
        appendAuditLog(db, { action: 'write_private_data', status: 'success', details: `ip=${getClientIp(req)}` });
        return jsonResponse(res, 200, { success: true });
      }

      if (key === 'public_data') {
        const normalized = normalizePublicDataPayload(parsed);
        if (!normalized) return jsonResponse(res, 400, { error: 'Invalid public_data payload' });

        const expectedHeader = Array.isArray(req.headers['x-expected-updated-at'])
          ? req.headers['x-expected-updated-at'][0]
          : req.headers['x-expected-updated-at'];
        if (expectedHeader !== undefined) {
          const expectedUpdatedAt = Number(expectedHeader);
          if (!Number.isFinite(expectedUpdatedAt) || expectedUpdatedAt < 0) {
            return jsonResponse(res, 400, { error: 'Invalid expected data version' });
          }
          const currentUpdatedAt = getPublicDataUpdatedAt(dbGetJson(db, key));
          if (currentUpdatedAt !== expectedUpdatedAt) {
            return jsonResponse(res, 409, {
              error: '数据已被其他会话更新，请刷新后重试',
              currentUpdatedAt
            });
          }
        }

        dbSetJson(db, key, normalized);
        appendAuditLog(db, { action: 'write_public_data', status: 'success', details: `ip=${getClientIp(req)}` });
        return jsonResponse(res, 200, { success: true, updatedAt: normalized.updatedAt });
      }
      if (key === 'storage_mode') {
        if (parsed?.mode !== 'sqlite' && parsed?.mode !== 'webdav') {
          return jsonResponse(res, 400, { error: 'Invalid storage mode' });
        }
        dbSetJson(db, key, { mode: parsed.mode });
        appendAuditLog(db, {
          action: 'write_storage_mode',
          status: 'success',
          details: `mode=${parsed?.mode || 'unknown'} ip=${getClientIp(req)}`
        });
        return jsonResponse(res, 200, { success: true });
      }
    }

    res.statusCode = 405;
    res.end();
  } catch (e) {
    if (e.code === 'PAYLOAD_TOO_LARGE') {
      return jsonResponse(res, 413, { error: 'Payload too large' });
    }
    console.error('SQLite API Error:', e);
    return jsonResponse(res, 500, { error: e.message });
  }
};
