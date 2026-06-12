import fs from 'fs';
import path from 'path';
import net from 'net';
import dns from 'node:dns';
import crypto from 'crypto';
import { Agent as UndiciAgent } from 'undici';
import Database from 'better-sqlite3';
import {
  timingSafeEqualText,
  hashPassword,
  verifyPasswordHash,
  normalizeMediaName,
  normalizePrivateDataPayload,
  isValidUsername,
  PASSWORD_MIN_LEN,
  PASSWORD_MAX_LEN
} from '../sharedSecurity.js';

// 运行时常量
export const SESSION_COOKIE = 'tat_session';
export const BODY_LIMIT_BYTES = 1024 * 1024;
export const MEDIA_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

// 数据库单例：生产/开发共享同一份实现
let dbInstance = null;
let maintenanceStarted = false;

// 周期清理过期 session：原本只在 verifySession 命中过期项时才删，
// 长期不被访问的过期 session 会在 kv_store 里堆积。每小时跑一次足够。
const cleanupExpiredSessions = (db) => {
  const rows = db.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'session:%'").all();
  if (rows.length === 0) return 0;

  const now = Date.now();
  const expiredKeys = [];
  for (const row of rows) {
    let data = null;
    try { data = JSON.parse(row.value); } catch { /* 损坏行直接清掉 */ }
    if (!data || typeof data.expiresAt !== 'number' || data.expiresAt <= now) {
      expiredKeys.push(row.key);
    }
  }
  if (expiredKeys.length === 0) return 0;

  const stmt = db.prepare('DELETE FROM kv_store WHERE key = ?');
  const tx = db.transaction((keys) => {
    for (const k of keys) stmt.run(k);
  });
  tx(expiredKeys);
  return expiredKeys.length;
};

const startMaintenance = (db) => {
  try { cleanupExpiredSessions(db); } catch { /* ignore */ }
  // unref 避免阻止进程退出
  setInterval(() => {
    try { cleanupExpiredSessions(db); } catch { /* ignore */ }
  }, 60 * 60 * 1000).unref();
};

export const ensureDb = () => {
  if (dbInstance) return dbInstance;
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbInstance = new Database(path.join(dataDir, 'local.db'));
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  if (!maintenanceStarted) {
    maintenanceStarted = true;
    startMaintenance(dbInstance);
  }
  return dbInstance;
};

// ===== 响应与请求工具 =====

export const jsonResponse = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.end(JSON.stringify(payload));
};

export const readBody = async (req, limit = BODY_LIMIT_BYTES) => {
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    received += buf.length;
    if (received > limit) {
      const err = new Error('Payload too large');
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(buf);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
};

export const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, item) => {
    const idx = item.indexOf('=');
    if (idx === -1) return acc;
    const key = item.slice(0, idx).trim();
    const value = decodeURIComponent(item.slice(idx + 1).trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
};

export const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

// ===== KV 存储 =====

export const dbGetJson = (db, key) => {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
};

export const dbSetJson = (db, key, value) => {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
};

export const dbDelete = (db, key) => {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
};

// 日志：保留最近 200 条
export const appendAuditLog = (db, entry) => {
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

const cleanAuditText = (value, maxLength) => {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

export const getStorageMode = (db) => {
  const modeData = dbGetJson(db, 'storage_mode');
  if (modeData?.mode === 'webdav' || modeData?.mode === 'sqlite') {
    return modeData.mode;
  }
  return 'sqlite';
};

// ===== Session =====

// 生产环境追加 Secure；开发态不需要
// SameSite=Strict：本应用是单源站点（前后端同域），无跨站登录场景，Strict 可彻底阻断 CSRF
const buildCookieString = (kv, isProduction) => {
  const parts = [kv, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (isProduction) parts.push('Secure');
  return parts;
};

export const buildCookie = (token, maxAgeSec, isProduction = false) => {
  const parts = buildCookieString(`${SESSION_COOKIE}=${encodeURIComponent(token)}`, isProduction);
  parts.push(`Max-Age=${maxAgeSec}`);
  return parts.join('; ');
};

export const clearCookie = (isProduction = false) => {
  const parts = buildCookieString(`${SESSION_COOKIE}=`, isProduction);
  parts.push('Max-Age=0');
  return parts.join('; ');
};

export const createSession = (db, remember) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSec = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = now + maxAgeSec * 1000;
  dbSetJson(db, `session:${token}`, { createdAt: now, expiresAt });
  return { token, maxAgeSec, expiresAt };
};

export const verifySession = (db, token) => {
  if (!token) return false;
  const data = dbGetJson(db, `session:${token}`);
  if (!data?.expiresAt || data.expiresAt <= Date.now()) {
    dbDelete(db, `session:${token}`);
    return false;
  }
  return true;
};

export const destroySession = (db, token) => {
  if (!token) return;
  dbDelete(db, `session:${token}`);
};

export const clearAllSessions = (db) => {
  db.prepare("DELETE FROM kv_store WHERE key LIKE 'session:%'").run();
};

export const requireAuth = (req, res, db) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (!verifySession(db, cookies[SESSION_COOKIE])) {
    jsonResponse(res, 401, { error: 'Unauthorized: Login required' });
    return false;
  }
  return true;
};

// ===== WebDAV =====

export const getWebDavConfig = (env) => {
  const { WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, WEBDAV_PATH } = env;
  if (!WEBDAV_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) return null;
  return {
    baseUrl: WEBDAV_URL.replace(/\/+$/, ''),
    davPath: (WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, ''),
    username: WEBDAV_USERNAME,
    password: WEBDAV_PASSWORD
  };
};

export const buildWebDavUrl = (env, filename = '') => {
  const config = getWebDavConfig(env);
  if (!config) return null;
  return `${config.baseUrl}/${config.davPath}${filename ? `/${filename}` : '/'}`;
};

const webdavAuthHeader = (config) =>
  `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

const WEBDAV_UA = 'Mozilla/5.0 (Node.js) NicheCard/1.0';

export const fetchWebDavJson = async (env, filename) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, filename), {
    method: 'GET',
    headers: { Authorization: webdavAuthHeader(config), 'User-Agent': WEBDAV_UA }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WebDAV request failed (${response.status})`);
  return response.json();
};

export const saveWebDavJson = async (env, filename, payload) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, filename), {
    method: 'PUT',
    headers: {
      Authorization: webdavAuthHeader(config),
      'User-Agent': WEBDAV_UA,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`WebDAV write failed (${response.status})`);
};

// ===== 封面引用解析（GC 用） =====

export const parseCoverReferenceSets = (publicData) => {
  const sqliteNames = new Set();
  const webdavNames = new Set();
  const cards = Array.isArray(publicData?.cards) ? publicData.cards : [];

  const collect = (rawUrl) => {
    const raw = String(rawUrl || '');
    if (!raw) return;
    let parsed;
    try { parsed = new URL(raw, 'http://local'); } catch { return; }

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
  };

  for (const card of cards) {
    collect(card?.coverUrl);
    collect(card?.coverVariants?.thumb);
    collect(card?.coverVariants?.card);
    collect(card?.coverVariants?.original);
  }
  return { sqliteNames, webdavNames };
};

export const collectSqliteMediaNames = (db) => {
  const rows = db.prepare("SELECT key FROM kv_store WHERE key LIKE 'media:%'").all();
  const names = [];
  for (const row of rows) {
    const key = String(row.key || '');
    if (!key.startsWith('media:')) continue;
    const name = normalizeMediaName(key.slice('media:'.length));
    if (name) names.push(name);
  }
  return names;
};

export const cleanupSqliteUnusedMedia = (db, referencedNames, limit = 100) => {
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

// WebDAV 列目录：用 PROPFIND + XML 提取 href
const decodeXmlEntities = (text) =>
  String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractHrefValuesFromXml = (xml) => {
  const values = [];
  const cdataRegex = /<[^>]*:?href[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/[^>]*:?href>/gi;
  const plainRegex = /<[^>]*:?href[^>]*>([^<]*)<\/[^>]*:?href>/gi;
  let m;
  while ((m = cdataRegex.exec(xml))) values.push(m[1] || '');
  while ((m = plainRegex.exec(xml))) values.push(m[1] || '');
  return values;
};

export const listWebDavCoverNames = async (env) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');

  const response = await fetch(buildWebDavUrl(env, 'covers'), {
    method: 'PROPFIND',
    headers: { Authorization: webdavAuthHeader(config), 'User-Agent': WEBDAV_UA, Depth: '1' }
  });
  if (response.status === 404) return [];
  if (!response.ok && response.status !== 207) {
    throw new Error(`WebDAV list failed (${response.status})`);
  }

  const xml = await response.text();
  const names = new Set();
  for (const rawValue of extractHrefValuesFromXml(xml)) {
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

export const deleteWebDavCoverFile = async (env, name) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, `covers/${name}`), {
    method: 'DELETE',
    headers: { Authorization: webdavAuthHeader(config), 'User-Agent': WEBDAV_UA }
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`WebDAV delete failed (${response.status})`);
};

export const cleanupWebDavUnusedMedia = async (env, referencedNames, limit = 100) => {
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

// ===== 管理员凭据解析 =====

export const ensureSqliteAdminFromEnv = async (db, env) => {
  const username = (env.ADMIN_USERNAME || '').trim();
  const password = env.ADMIN_PASSWORD || '';
  if (!username || !password) return null;
  const creds = { username, passwordHash: await hashPassword(password), passwordUpdatedAt: Date.now() };
  dbSetJson(db, 'private_data', creds);
  return creds;
};

export const resolveAdminCredentials = async (db, env) => {
  const mode = getStorageMode(db);
  if (mode === 'webdav') {
    try {
      const webdavCreds = await fetchWebDavJson(env, 'private_data.json');
      if (webdavCreds?.username && (webdavCreds?.password || webdavCreds?.passwordHash)) {
        return { creds: webdavCreds, source: 'webdav' };
      }
    } catch {
      return { error: 'WebDAV 凭据读取失败，请检查 WebDAV 配置' };
    }
  }

  const sqliteCreds = dbGetJson(db, 'private_data');
  if (sqliteCreds?.username && (sqliteCreds?.password || sqliteCreds?.passwordHash)) {
    return { creds: sqliteCreds, source: 'sqlite' };
  }

  const seeded = await ensureSqliteAdminFromEnv(db, env);
  if (seeded) return { creds: seeded, source: 'sqlite' };

  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
};

export const buildAdminCredentialsForSave = async (existing, payload) => {
  const username = String(payload?.username || '').trim();
  if (!isValidUsername(username)) {
    return { error: '账号需由 3–64 位字母、数字、下划线或横线组成' };
  }

  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : '';
  const hasNewPassword = newPassword.length > 0;
  if (hasNewPassword && (newPassword.length < PASSWORD_MIN_LEN || newPassword.length > PASSWORD_MAX_LEN)) {
    return { error: `密码长度需在 ${PASSWORD_MIN_LEN}–${PASSWORD_MAX_LEN} 之间` };
  }

  const existingHash = typeof existing?.passwordHash === 'string' ? existing.passwordHash : '';
  const legacyPassword = typeof existing?.password === 'string' ? existing.password : '';

  let passwordHash = existingHash;
  const usernameChanged = username !== String(existing?.username || '');
  if (hasNewPassword) {
    passwordHash = await hashPassword(newPassword);
  } else if (!passwordHash && legacyPassword) {
    passwordHash = await hashPassword(legacyPassword);
  }

  if (!passwordHash) return { error: '请提供新密码' };

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

export const buildPrivateDataForTarget = async (payload) => {
  const normalized = normalizePrivateDataPayload(payload);
  if (!normalized) return { error: 'Invalid private_data payload' };
  return {
    data: {
      username: normalized.username,
      passwordHash: normalized.passwordHash,
      passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
    }
  };
};

// ===== SSRF 防护（/remote-image 用） =====

const isPrivateIpv4 = (host) => {
  const parts = host.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
};

const isPrivateIpv6 = (host) => {
  const v = host.toLowerCase();
  if (v === '::1') return true;
  if (v.startsWith('fe80:')) return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  return false;
};

export const isBlockedRemoteHost = (hostname) => {
  const v = String(hostname || '').trim().replace(/\.$/, '').toLowerCase();
  if (!v) return true;
  if (v === 'localhost' || v.endsWith('.localhost') || v.endsWith('.local')) return true;
  const ipVersion = net.isIP(v);
  if (ipVersion === 4) return isPrivateIpv4(v);
  if (ipVersion === 6) return isPrivateIpv6(v);
  return false;
};

// DNS-rebinding 防护：fetch 实际连接时再做一次 IP 段校验。
// 字符串层 isBlockedRemoteHost 只能识别明显的内网 hostname/IP；攻击者可让 evil.com 第一次解析为公网 IP（绕过字符串检查），
// 实际 socket 连接时再解析为 192.168.x.x。这里把 lookup 交给 undici Agent，所有解析结果都校验。
const safeDnsLookup = (hostname, opts, cb) => {
  const options = typeof opts === 'number' ? { family: opts } : (opts || {});
  dns.lookup(hostname, {
    all: true,
    family: options.family || 0,
    hints: options.hints,
    verbatim: options.verbatim
  }, (err, addresses) => {
    if (err) return cb(err);
    if (!addresses || addresses.length === 0) {
      return cb(new Error('No DNS records'));
    }
    for (const a of addresses) {
      if (isBlockedRemoteHost(a.address)) {
        return cb(new Error(`Blocked private address: ${a.address}`));
      }
    }
    if (options.all) {
      return cb(null, addresses.map((item) => ({ address: item.address, family: item.family })));
    }
    const first = addresses[0];
    cb(null, first.address, first.family);
  });
};

const safeFetchAgent = new UndiciAgent({
  connect: { lookup: safeDnsLookup }
});

// ===== CSRF：写接口必须同源 =====
//
// Cookie 已是 SameSite=Strict，但作为深度防御：所有写方法（含 WebDAV 隧道方法）都校验 Origin/Referer。
// 浏览器同源 fetch 至少会带其中之一；都没有视为可疑。
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STATE_CHANGING_DAV_METHODS = new Set(['PUT', 'DELETE', 'MKCOL', 'PROPPATCH', 'MOVE', 'COPY', 'LOCK', 'UNLOCK', 'PROPFIND']);

const isStateChangingRequest = (req) => {
  const method = String(req.method || '').toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) return true;
  const tunneled = req.headers['x-dav-method'];
  if (tunneled) {
    const real = String(Array.isArray(tunneled) ? tunneled[0] : tunneled).toUpperCase();
    if (STATE_CHANGING_DAV_METHODS.has(real)) return true;
  }
  return false;
};

const isSameOriginRequest = (req) => {
  const host = String(req.headers.host || '');
  if (!host) return false;
  const allowed = new Set([`http://${host}`, `https://${host}`]);

  const origin = String(req.headers.origin || '');
  if (origin) return allowed.has(origin);

  const referer = String(req.headers.referer || '');
  if (referer) {
    try {
      const parsed = new URL(referer);
      return allowed.has(`${parsed.protocol}//${parsed.host}`);
    } catch {
      return false;
    }
  }
  return false;
};

const enforceSameOrigin = (req, res) => {
  if (!isStateChangingRequest(req)) return true;
  if (isSameOriginRequest(req)) return true;
  jsonResponse(res, 403, { error: 'Cross-origin request not allowed' });
  return false;
};

// ===== 主 handler：WebDAV 代理 =====

export const handleWebDavApi = async (req, res, { env }) => {
  if (!enforceSameOrigin(req, res)) return;
  const db = ensureDb();
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'local'}`);
    const filename = (url.searchParams.get('filename') || '').trim();
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
      Authorization: webdavAuthHeader(config),
      'User-Agent': WEBDAV_UA
    };
    if (req.headers.depth) headers.Depth = req.headers.depth;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      const rawBody = await readBody(req, MEDIA_BODY_LIMIT_BYTES);
      body = rawBody.length > 0 ? new Uint8Array(rawBody) : null;
    }

    const davResponse = await fetch(buildWebDavUrl(env, filename), { method, headers, body });
    res.statusCode = davResponse.status;
    const contentType = davResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const arrayBuffer = await davResponse.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
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
        headers: { 'User-Agent': WEBDAV_UA, Accept: 'image/*,*/*;q=0.8' },
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
        appendAuditLog(db, { action: 'write_public_data', status: 'success', details: `ip=${getClientIp(req)}` });
      }
      if (key === 'storage_mode') {
        appendAuditLog(db, {
          action: 'write_storage_mode',
          status: 'success',
          details: `mode=${parsed?.mode || 'unknown'} ip=${getClientIp(req)}`
        });
      }

      dbSetJson(db, key, parsed);
      return jsonResponse(res, 200, { success: true });
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
