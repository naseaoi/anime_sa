import { defineConfig, loadEnv, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  timingSafeEqualText,
  hashPassword,
  verifyPasswordHash,
  normalizeMediaName,
  normalizePrivateDataPayload
} from './server/sharedSecurity.js';

let dbInstance: ReturnType<typeof Database> | null = null;

const SESSION_COOKIE = 'tat_session';
const BODY_LIMIT_BYTES = 1024 * 1024;
const MEDIA_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

const ensureDb = () => {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'local.db');
  dbInstance = new Database(dbPath);
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  return dbInstance;
};

const jsonResponse = (res: any, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readBody = async (req: any, limit = BODY_LIMIT_BYTES): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    received += buf.length;
    if (received > limit) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(buf);
  }
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
};

const parseCookies = (header = ''): Record<string, string> => {
  return header.split(';').reduce<Record<string, string>>((acc, item) => {
    const idx = item.indexOf('=');
    if (idx < 0) return acc;
    const key = item.slice(0, idx).trim();
    const value = decodeURIComponent(item.slice(idx + 1).trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
};

const dbGetJson = (db: ReturnType<typeof Database>, key: string): any | null => {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
};

const dbSetJson = (db: ReturnType<typeof Database>, key: string, value: unknown) => {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
};

const dbDelete = (db: ReturnType<typeof Database>, key: string) => {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
};

const appendAuditLog = (db: ReturnType<typeof Database>, entry: { action: string; status?: 'success' | 'failed'; details?: string; message?: string }) => {
  const current = dbGetJson(db, 'audit_logs');
  const list = Array.isArray(current) ? current : [];
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    action: String(entry.action || 'unknown'),
    status: entry.status === 'failed' ? 'failed' : 'success',
    details: entry.details ? String(entry.details) : '',
    message: entry.message ? String(entry.message) : ''
  });
  dbSetJson(db, 'audit_logs', list.slice(0, 200));
};

const getClientIp = (req: any) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return String(xForwardedFor[0]).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};


const getStorageMode = (db: ReturnType<typeof Database>): 'sqlite' | 'webdav' => {
  const modeData = dbGetJson(db, 'storage_mode');
  if (modeData?.mode === 'webdav' || modeData?.mode === 'sqlite') {
    return modeData.mode;
  }
  return 'sqlite';
};

const buildCookie = (token: string, maxAgeSec: number) => {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  return parts.join('; ');
};

const clearCookie = () => {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
};

const createSession = (db: ReturnType<typeof Database>, remember: boolean) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSec = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = now + maxAgeSec * 1000;
  dbSetJson(db, `session:${token}`, { createdAt: now, expiresAt });
  return { token, maxAgeSec, expiresAt };
};

const verifySession = (db: ReturnType<typeof Database>, token: string | undefined) => {
  if (!token) return false;
  const session = dbGetJson(db, `session:${token}`);
  if (!session?.expiresAt || session.expiresAt <= Date.now()) {
    dbDelete(db, `session:${token}`);
    return false;
  }
  return true;
};

const clearAllSessions = (db: ReturnType<typeof Database>) => {
  db.prepare("DELETE FROM kv_store WHERE key LIKE 'session:%'").run();
};

const requireAuth = (req: any, res: any, db: ReturnType<typeof Database>) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const ok = verifySession(db, cookies[SESSION_COOKIE]);
  if (!ok) {
    jsonResponse(res, 401, { error: 'Unauthorized: Login required' });
    return false;
  }
  return true;
};

const ensureSqliteAdminFromEnv = (db: ReturnType<typeof Database>) => {
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) return null;
  const creds = { username, passwordHash: hashPassword(password), passwordUpdatedAt: Date.now() };
  dbSetJson(db, 'private_data', creds);
  return creds;
};

const getWebDavConfig = (env: Record<string, string>) => {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = env;
  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) return null;
  const baseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const davPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  return { baseUrl, davPath, username: VITE_WEBDAV_USERNAME, password: VITE_WEBDAV_PASSWORD };
};

const buildWebDavUrl = (env: Record<string, string>, filename = '') => {
  const config = getWebDavConfig(env);
  if (!config) return null;
  return `${config.baseUrl}/${config.davPath}${filename ? `/${filename}` : '/'}`;
};

const fetchWebDavJson = async (env: Record<string, string>, filename: string) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in .env');
  const targetUrl = buildWebDavUrl(env, filename);
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const res = await fetch(targetUrl as string, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`WebDAV request failed (${res.status})`);
  return res.json();
};

const saveWebDavJson = async (env: Record<string, string>, filename: string, payload: unknown) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in .env');

  const targetUrl = buildWebDavUrl(env, filename);
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const res = await fetch(targetUrl as string, {
    method: 'PUT',
    headers: {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`WebDAV write failed (${res.status})`);
};

const parseCoverReferenceSets = (publicData: any) => {
  const sqliteNames = new Set<string>();
  const webdavNames = new Set<string>();
  const cards = Array.isArray(publicData?.cards) ? publicData.cards : [];

  for (const card of cards) {
    const raw = String(card?.coverUrl || '');
    if (!raw) continue;

    let parsed: URL;
    try {
      parsed = new URL(raw, 'http://local');
    } catch {
      continue;
    }

    if (parsed.pathname === '/api/sqlite/media') {
      const name = normalizeMediaName(parsed.searchParams.get('name'));
      if (name) sqliteNames.add(name);
    }

    if (parsed.pathname === '/api/webdav') {
      const filename = decodeURIComponent(parsed.searchParams.get('filename') || '');
      if (filename.startsWith('covers/')) {
        const name = normalizeMediaName(filename.slice('covers/'.length));
        if (name) webdavNames.add(name);
      }
    }
  }

  return { sqliteNames, webdavNames };
};

const collectSqliteMediaNames = (db: ReturnType<typeof Database>) => {
  const rows = db.prepare("SELECT key FROM kv_store WHERE key LIKE 'media:%'").all() as Array<{ key: string }>;
  const names: string[] = [];
  for (const row of rows) {
    const key = String(row.key || '');
    if (!key.startsWith('media:')) continue;
    const name = normalizeMediaName(key.slice('media:'.length));
    if (name) names.push(name);
  }
  return names;
};

const cleanupSqliteUnusedMedia = (db: ReturnType<typeof Database>, referencedNames: Set<string>, limit = 100) => {
  const allNames = collectSqliteMediaNames(db);
  const removable = allNames.filter((name) => !referencedNames.has(name));
  const candidates = removable.slice(0, Math.max(1, limit));
  let removed = 0;
  for (const name of candidates) {
    dbDelete(db, `media:${name}`);
    removed += 1;
  }
  const pending = Math.max(0, removable.length - removed);
  return { checked: allNames.length, removed, pending, hasMore: pending > 0 };
};

const decodeXmlEntities = (text: string) => {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

const extractHrefValuesFromXml = (xml: string) => {
  const values: string[] = [];
  const cdataRegex = /<[^>]*:?href[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/[^>]*:?href>/gi;
  const plainRegex = /<[^>]*:?href[^>]*>([^<]*)<\/[^>]*:?href>/gi;

  let match = cdataRegex.exec(xml);
  while (match) {
    values.push(match[1] || '');
    match = cdataRegex.exec(xml);
  }

  match = plainRegex.exec(xml);
  while (match) {
    values.push(match[1] || '');
    match = plainRegex.exec(xml);
  }

  return values;
};

const listWebDavCoverNames = async (env: Record<string, string>) => {
  const config = getWebDavConfig(env);
  if (!config) {
    throw new Error('Missing WebDAV configuration in .env');
  }

  const targetUrl = buildWebDavUrl(env, 'covers');
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const res = await fetch(targetUrl as string, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0',
      Depth: '1'
    }
  });

  if (res.status === 404) return [];
  if (!res.ok && res.status !== 207) {
    throw new Error(`WebDAV list failed (${res.status})`);
  }

  const xml = await res.text();
  const names = new Set<string>();
  const hrefValues = extractHrefValuesFromXml(xml);
  for (const rawValue of hrefValues) {
    const href = decodeXmlEntities(rawValue || '').trim();
    try {
      const parsed = new URL(href, config.baseUrl);
      const pathPart = decodeURIComponent(parsed.pathname);
      const marker = '/covers/';
      const idx = pathPart.lastIndexOf(marker);
      if (idx >= 0) {
        const name = pathPart.slice(idx + marker.length).replace(/\/+$/, '');
        const normalized = normalizeMediaName(name);
        if (normalized) names.add(normalized);
      }
    } catch {}
  }

  return [...names];
};

const deleteWebDavCoverFile = async (env: Record<string, string>, name: string) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in .env');

  const targetUrl = buildWebDavUrl(env, `covers/${name}`);
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const res = await fetch(targetUrl as string, {
    method: 'DELETE',
    headers: {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
    }
  });

  if (res.status === 404) return;
  if (!res.ok) throw new Error(`WebDAV delete failed (${res.status})`);
};

const cleanupWebDavUnusedMedia = async (env: Record<string, string>, referencedNames: Set<string>, limit = 100) => {
  const allNames = await listWebDavCoverNames(env);
  const removable = allNames.filter((name) => !referencedNames.has(name));
  const candidates = removable.slice(0, Math.max(1, limit));
  let removed = 0;
  for (const name of candidates) {
    await deleteWebDavCoverFile(env, name);
    removed += 1;
  }
  const pending = Math.max(0, removable.length - removed);
  return { checked: allNames.length, removed, pending, hasMore: pending > 0 };
};

const resolveAdminCredentials = async (db: ReturnType<typeof Database>, env: Record<string, string>) => {
  const mode = getStorageMode(db);
  if (mode === 'webdav') {
    try {
      const webdavCreds = await fetchWebDavJson(env, 'private_data.json');
      if (webdavCreds?.username && (webdavCreds?.password || webdavCreds?.passwordHash)) {
        return { creds: webdavCreds, source: 'webdav' };
      }
    } catch {
      return { error: 'WebDAV 凭据读取失败，请检查配置' };
    }
  }

  const sqliteCreds = dbGetJson(db, 'private_data');
  if (sqliteCreds?.username && (sqliteCreds?.password || sqliteCreds?.passwordHash)) {
    return { creds: sqliteCreds, source: 'sqlite' };
  }

  const seeded = ensureSqliteAdminFromEnv(db);
  if (seeded) return { creds: seeded, source: 'sqlite' };

  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
};

const buildAdminCredentialsForSave = (existing: any, payload: any) => {
  const username = String(payload?.username || '').trim();
  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : '';
  if (!username) {
    return { error: '账号不能为空' };
  }

  const hasNewPassword = newPassword.length > 0;
  const existingHash = typeof existing?.passwordHash === 'string' ? existing.passwordHash : '';
  const legacyPassword = typeof existing?.password === 'string' ? existing.password : '';

  let passwordHash = existingHash;
  const usernameChanged = username !== String(existing?.username || '');
  if (hasNewPassword) {
    passwordHash = hashPassword(newPassword);
  } else if (!passwordHash && legacyPassword) {
    passwordHash = hashPassword(legacyPassword);
  }

  if (!passwordHash) {
    return { error: '请提供新密码' };
  }

  return {
    data: {
      username,
      passwordHash,
      passwordUpdatedAt: hasNewPassword ? Date.now() : Number(existing?.passwordUpdatedAt || Date.now())
    },
    passwordChanged: hasNewPassword,
    changed: usernameChanged || hasNewPassword
  };
};

const buildPrivateDataForTarget = (payload: unknown) => {
  const normalized = normalizePrivateDataPayload(payload as any);
  if (!normalized) {
    return { error: 'Invalid private_data payload' };
  }

  return {
    data: {
      username: normalized.username,
      passwordHash: normalized.passwordHash || hashPassword(normalized.password || ''),
      passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
    }
  };
};

const installApiMiddlewares = (server: ViteDevServer, env: Record<string, string>) => {
  server.middlewares.use('/api/webdav', async (req: any, res: any) => {
    const db = ensureDb();
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const filename = (url.searchParams.get('filename') || '').trim();
      const config = getWebDavConfig(env);

      if (!config) {
        return jsonResponse(res, 500, { error: 'Missing WebDAV configuration in .env' });
      }

      const tunneledMethod = req.headers['x-dav-method'];
      const methodRaw = Array.isArray(tunneledMethod) ? tunneledMethod[0] : (tunneledMethod || req.method || 'GET');
      const method = String(methodRaw).toUpperCase();
      const mutatingMethods = new Set(['PUT', 'DELETE', 'MKCOL', 'PROPPATCH', 'MOVE', 'COPY', 'LOCK', 'UNLOCK']);
      const needsAuth = filename === 'private_data.json' || mutatingMethods.has(method);

      if (needsAuth && !requireAuth(req, res, db)) {
        return;
      }

      const targetUrl = buildWebDavUrl(env, filename);
      const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
      const headers: Record<string, string> = {
        Authorization: authHeader,
        'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
      };

      if (req.headers.depth) headers.Depth = req.headers.depth as string;
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;

      let body: Buffer | null = null;
      if (method !== 'GET' && method !== 'HEAD') {
        const rawBody = await readBody(req);
        body = rawBody.length > 0 ? rawBody : null;
      }

      const davResponse = await fetch(targetUrl as string, {
        method,
        headers,
        body: body ? new Uint8Array(body) : undefined
      });

      res.statusCode = davResponse.status;
      const contentType = davResponse.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const arrayBuffer = await davResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (e: any) {
      if (e.message === 'PAYLOAD_TOO_LARGE') {
        return jsonResponse(res, 413, { error: 'Payload too large' });
      }
      return jsonResponse(res, 500, { error: e.message });
    }
  });

  server.middlewares.use('/api/sqlite', async (req: any, res: any) => {
    const db = ensureDb();
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);

      if (url.pathname.endsWith('/login')) {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const rawBody = await readBody(req);
        const body = JSON.parse(rawBody.toString() || '{}');
        const resolved = await resolveAdminCredentials(db, env);
        if (!resolved.creds) {
          return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
        }

        const usernameOk = timingSafeEqualText(body.username || '', resolved.creds.username || '');
        const hash = resolved.creds.passwordHash;
        const legacyPlain = resolved.creds.password;
        const passwordOk = typeof hash === 'string'
          ? verifyPasswordHash(body.password || '', hash)
          : timingSafeEqualText(body.password || '', legacyPlain || '');

        if (usernameOk && passwordOk) {
          if (!hash && resolved.source === 'sqlite') {
            dbSetJson(db, 'private_data', {
              username: resolved.creds.username,
              passwordHash: hashPassword(body.password || ''),
              passwordUpdatedAt: Date.now()
            });
          }
          if (!hash && resolved.source === 'webdav') {
            saveWebDavJson(env, 'private_data.json', {
              username: resolved.creds.username,
              passwordHash: hashPassword(body.password || ''),
              passwordUpdatedAt: Date.now()
            }).catch(() => {});
          }
          const session = createSession(db, !!body.remember);
          res.setHeader('Set-Cookie', buildCookie(session.token, session.maxAgeSec));
          return jsonResponse(res, 200, { success: true, expiresAt: session.expiresAt });
        }
        return jsonResponse(res, 401, { success: false, error: 'Invalid credentials' });
      }

      if (url.pathname.endsWith('/logout')) {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const cookies = parseCookies(req.headers.cookie || '');
        if (cookies[SESSION_COOKIE]) {
          dbDelete(db, `session:${cookies[SESSION_COOKIE]}`);
        }
        res.setHeader('Set-Cookie', clearCookie());
        return jsonResponse(res, 200, { success: true });
      }

      if (url.pathname.endsWith('/session')) {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const cookies = parseCookies(req.headers.cookie || '');
        return jsonResponse(res, 200, { authenticated: verifySession(db, cookies[SESSION_COOKIE]) });
      }

      if (url.pathname.endsWith('/admin-profile')) {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!requireAuth(req, res, db)) return;
        const resolved = await resolveAdminCredentials(db, env);
        if (!resolved.creds) {
          return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
        }
        return jsonResponse(res, 200, { username: String(resolved.creds.username || '') });
      }

      if (url.pathname.endsWith('/audit-logs')) {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!requireAuth(req, res, db)) return;
        const limitRaw = Number(url.searchParams.get('limit') || 50);
        const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
        const logs = dbGetJson(db, 'audit_logs');
        const items = Array.isArray(logs) ? logs.slice(0, limit) : [];
        return jsonResponse(res, 200, { items });
      }

      if (url.pathname.endsWith('/admin-credentials')) {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!requireAuth(req, res, db)) return;

        const rawBody = await readBody(req);
        let body: any;
        try {
          body = JSON.parse(rawBody.toString() || '{}');
        } catch {
          return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' });
        }

        const resolved = await resolveAdminCredentials(db, env);
        if (!resolved.creds) {
          return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
        }

        const next = buildAdminCredentialsForSave(resolved.creds, body);
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

        if (next.changed) {
          clearAllSessions(db);
        }

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

      if (url.pathname.endsWith('/admin-credentials-sync')) {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!requireAuth(req, res, db)) return;

        const target = url.searchParams.get('target');
        if (target !== 'sqlite' && target !== 'webdav') {
          return jsonResponse(res, 400, { success: false, error: 'Invalid target' });
        }

        const rawBody = await readBody(req);
        let body: unknown;
        try {
          body = JSON.parse(rawBody.toString() || '{}');
        } catch {
          return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' });
        }

        const next = buildPrivateDataForTarget(body);
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

      if (url.pathname.endsWith('/media-gc')) {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
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

      if (url.pathname.endsWith('/media')) {
        const mediaName = normalizeMediaName(url.searchParams.get('name'));
        if (!mediaName) {
          return jsonResponse(res, 400, { error: 'Invalid media name' });
        }

        const mediaKey = `media:${mediaName}`;
        if (req.method === 'GET') {
          const media = dbGetJson(db, mediaKey);
          if (!media?.base64) {
            return jsonResponse(res, 404, { error: 'Media not found' });
          }
          const contentType = String(media.contentType || 'application/octet-stream');
          const bytes = Buffer.from(media.base64, 'base64');
          res.statusCode = 200;
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', bytes.length);
          res.end(bytes);
          return;
        }

        if (req.method === 'POST') {
          if (!requireAuth(req, res, db)) return;
          const rawBody = await readBody(req, MEDIA_BODY_LIMIT_BYTES);
          const contentType = String(req.headers['content-type'] || 'application/octet-stream');
          dbSetJson(db, mediaKey, {
            contentType,
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

      const key = url.searchParams.get('key');
      if (!key) {
        return jsonResponse(res, 400, { error: 'Missing key parameter' });
      }

      const isWrite = req.method === 'POST';
      const isPrivateRead = req.method === 'GET' && key === 'private_data';
      if ((isWrite || isPrivateRead) && !requireAuth(req, res, db)) {
        return;
      }

      if (req.method === 'GET') {
        return jsonResponse(res, 200, dbGetJson(db, key) || null);
      }

      if (req.method === 'POST') {
        const rawBody = await readBody(req);
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody.toString() || '{}');
        } catch {
          return jsonResponse(res, 400, { error: 'Invalid JSON body' });
        }

        if (key === 'private_data') {
          const normalized = normalizePrivateDataPayload(parsed as any);
          if (!normalized) {
            return jsonResponse(res, 400, { error: 'Invalid private_data payload' });
          }

          const privateData = {
            username: normalized.username,
            passwordHash: normalized.passwordHash || hashPassword(normalized.password || ''),
            passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
          };
          dbSetJson(db, key, privateData);
          appendAuditLog(db, {
            action: 'write_private_data',
            status: 'success',
            details: `ip=${getClientIp(req)}`
          });
          return jsonResponse(res, 200, { success: true });
        }

        if (key === 'public_data') {
          appendAuditLog(db, {
            action: 'write_public_data',
            status: 'success',
            details: `ip=${getClientIp(req)}`
          });
        }
        if (key === 'storage_mode') {
          appendAuditLog(db, {
            action: 'write_storage_mode',
            status: 'success',
            details: `mode=${(parsed as any)?.mode || 'unknown'} ip=${getClientIp(req)}`
          });
        }

        dbSetJson(db, key, parsed);
        return jsonResponse(res, 200, { success: true });
      }

      res.statusCode = 405;
      res.end();
    } catch (e: any) {
      if (e.message === 'PAYLOAD_TOO_LARGE') {
        return jsonResponse(res, 413, { error: 'Payload too large' });
      }
      return jsonResponse(res, 500, { error: e.message });
    }
  });
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    plugins: [
      react(),
      {
        name: 'configure-server',
        configureServer(server) {
          installApiMiddlewares(server, env);
        }
      }
    ]
  };
});
