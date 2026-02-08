import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import Database from 'better-sqlite3';

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      const val = values.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(process.cwd(), 'dist');
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSION_COOKIE = 'tat_session';
const BODY_LIMIT_BYTES = 1024 * 1024;
const API_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const API_RATE_LIMIT_MAX = 600;
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 20;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const isCompressibleType = (contentType) => {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('javascript') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('svg')
  );
};

const createWeakEtag = (stat) => {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
};

const streamWithOptionalCompression = (req, res, filePath, contentType, stat) => {
  const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
  const canCompress = isCompressibleType(contentType) && stat.size > 1024;
  const useBrotli = canCompress && acceptEncoding.includes('br');
  const useGzip = canCompress && !useBrotli && acceptEncoding.includes('gzip');

  if (useBrotli || useGzip) {
    res.setHeader('Vary', 'Accept-Encoding');
    res.removeHeader('Content-Length');
  } else {
    res.setHeader('Content-Length', stat.size);
  }

  const input = fs.createReadStream(filePath);
  input.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Server Error: STREAM_READ');
      return;
    }
    res.destroy();
  });

  if (useBrotli) {
    res.setHeader('Content-Encoding', 'br');
    input.pipe(zlib.createBrotliCompress()).pipe(res);
    return;
  }

  if (useGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    input.pipe(zlib.createGzip()).pipe(res);
    return;
  }

  input.pipe(res);
};

let dbInstance = null;
const rateLimitStore = new Map();

const ensureDb = () => {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const dbPath = path.join(DATA_DIR, 'local.db');
  dbInstance = new Database(dbPath);
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  return dbInstance;
};

const jsonResponse = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.end(JSON.stringify(payload));
};

const getClientIp = (req) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0].split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

const cleanupRateLimitStore = (now) => {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const checkRateLimit = (req, res, scope, max, windowMs) => {
  const now = Date.now();
  cleanupRateLimitStore(now);

  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    jsonResponse(res, 429, { error: 'Too many requests', retryAfterSec });
    return false;
  }

  record.count += 1;
  return true;
};

const setSecurityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
};

const readRequestBody = async (req, limit = BODY_LIMIT_BYTES) => {
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > limit) {
      const err = new Error('Payload too large');
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, item) => {
    const idx = item.indexOf('=');
    if (idx === -1) return acc;
    const key = item.slice(0, idx).trim();
    const value = decodeURIComponent(item.slice(idx + 1).trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
};

const dbGetJson = (db, key) => {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return null;
  }
};

const dbSetJson = (db, key, value) => {
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
};

const dbDelete = (db, key) => {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
};

const getStorageMode = (db) => {
  const modeData = dbGetJson(db, 'storage_mode');
  if (modeData?.mode === 'webdav' || modeData?.mode === 'sqlite') {
    return modeData.mode;
  }
  return 'sqlite';
};

const buildCookie = (token, maxAgeSec) => {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
};

const clearCookie = () => {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
};

const createSession = (db, remember) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSec = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = now + maxAgeSec * 1000;
  dbSetJson(db, `session:${token}`, { createdAt: now, expiresAt });
  return { token, maxAgeSec, expiresAt };
};

const verifySession = (db, token) => {
  if (!token) return false;
  const data = dbGetJson(db, `session:${token}`);
  if (!data?.expiresAt || data.expiresAt <= Date.now()) {
    dbDelete(db, `session:${token}`);
    return false;
  }
  return true;
};

const destroySession = (db, token) => {
  if (!token) return;
  dbDelete(db, `session:${token}`);
};

const requireAuth = (req, res, db) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE] || '';
  const ok = verifySession(db, token);
  if (!ok) {
    jsonResponse(res, 401, { error: 'Unauthorized: Login required' });
    return false;
  }
  return true;
};

const getWebDavConfig = () => {
  const { VITE_WEBDAV_URL, VITE_WEBDAV_USERNAME, VITE_WEBDAV_PASSWORD, VITE_WEBDAV_PATH } = process.env;
  if (!VITE_WEBDAV_URL || !VITE_WEBDAV_USERNAME || !VITE_WEBDAV_PASSWORD) return null;

  const cleanBaseUrl = VITE_WEBDAV_URL.replace(/\/+$/, '');
  const cleanPath = (VITE_WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, '');
  return {
    baseUrl: cleanBaseUrl,
    path: cleanPath,
    username: VITE_WEBDAV_USERNAME,
    password: VITE_WEBDAV_PASSWORD
  };
};

const buildWebDavUrl = (filename = '') => {
  const config = getWebDavConfig();
  if (!config) return null;
  const suffix = filename ? `/${filename}` : '/';
  return `${config.baseUrl}/${config.path}${suffix}`;
};

const fetchWebDavJson = async (filename) => {
  const config = getWebDavConfig();
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const targetUrl = buildWebDavUrl(filename);
  const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`WebDAV request failed (${response.status})`);
  }
  return response.json();
};

const ensureSqliteAdminFromEnv = (db) => {
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) return null;

  const creds = { username, password };
  dbSetJson(db, 'private_data', creds);
  return creds;
};

const resolveAdminCredentials = async (db) => {
  const mode = getStorageMode(db);

  if (mode === 'webdav') {
    try {
      const webdavCreds = await fetchWebDavJson('private_data.json');
      if (webdavCreds?.username && webdavCreds?.password) {
        return { creds: webdavCreds };
      }
    } catch (e) {
      return { error: 'WebDAV 凭据读取失败，请检查 WebDAV 配置' };
    }
  }

  const sqliteCreds = dbGetJson(db, 'private_data');
  if (sqliteCreds?.username && sqliteCreds?.password) {
    return { creds: sqliteCreds };
  }

  const seeded = ensureSqliteAdminFromEnv(db);
  if (seeded) {
    return { creds: seeded };
  }

  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
};

const handleWebDav = async (req, res, db) => {
  try {
    setSecurityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filename = (url.searchParams.get('filename') || '').trim();
    const config = getWebDavConfig();

    if (!config) {
      return jsonResponse(res, 500, { error: 'Missing WebDAV configuration in environment variables' });
    }

    const tunneledMethod = req.headers['x-dav-method'];
    const methodRaw = Array.isArray(tunneledMethod) ? tunneledMethod[0] : (tunneledMethod || req.method || 'GET');
    const method = methodRaw.toUpperCase();
    const mutatingMethods = new Set(['PUT', 'DELETE', 'MKCOL', 'PROPPATCH', 'MOVE', 'COPY', 'LOCK', 'UNLOCK']);
    const needsAuth = filename === 'private_data.json' || mutatingMethods.has(method);

    if (needsAuth && !requireAuth(req, res, db)) {
      return;
    }

    const targetUrl = buildWebDavUrl(filename);
    const authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;

    const headers = {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Node.js) NicheCard/1.0'
    };

    if (req.headers.depth) headers.Depth = req.headers.depth;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      const rawBody = await readRequestBody(req);
      body = rawBody.length > 0 ? rawBody : null;
    }

    const davResponse = await fetch(targetUrl, {
      method,
      headers,
      body
    });

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

const handleSqlite = async (req, res) => {
  const db = ensureDb();
  try {
    setSecurityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.endsWith('/login')) {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }

      const rawBody = await readRequestBody(req);
      const body = JSON.parse(rawBody.toString() || '{}');
      const { username, password, remember } = body;
      const resolved = await resolveAdminCredentials(db);
      if (!resolved.creds) {
        return jsonResponse(res, 503, { success: false, error: resolved.error || '管理员账号不可用' });
      }

      if (username === resolved.creds.username && password === resolved.creds.password) {
        const session = createSession(db, !!remember);
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
      destroySession(db, cookies[SESSION_COOKIE]);
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
      const authenticated = verifySession(db, cookies[SESSION_COOKIE]);
      return jsonResponse(res, 200, { authenticated });
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
      const data = dbGetJson(db, key);
      return jsonResponse(res, 200, data || null);
    }

    if (req.method === 'POST') {
      const rawBody = await readRequestBody(req);
      const bodyStr = rawBody.toString();
      let parsed;
      try {
        parsed = JSON.parse(bodyStr);
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Invalid JSON body' });
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
    console.error('SQLite Middleware Error:', e);
    return jsonResponse(res, 500, { error: e.message });
  }
};

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/webdav')) {
    if (!checkRateLimit(req, res, 'api:webdav', API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS)) {
      return;
    }
    await handleWebDav(req, res, ensureDb());
    return;
  }

  if (url.pathname.startsWith('/api/sqlite')) {
    if (url.pathname.endsWith('/login')) {
      if (!checkRateLimit(req, res, 'api:login', LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS)) {
        return;
      }
    } else if (!checkRateLimit(req, res, 'api:sqlite', API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS)) {
      return;
    }
    await handleSqlite(req, res);
    return;
  }

  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  let fileStat;
  try {
    fileStat = fs.statSync(filePath);
  } catch (e) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const etag = createWeakEtag(fileStat);
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', fileStat.mtime.toUTCString());

  if (filePath.endsWith('index.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  streamWithOptionalCompression(req, res, filePath, contentType, fileStat);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`- WebDAV Mode: ${process.env.VITE_WEBDAV_URL ? 'Enabled' : 'Disabled (Missing Env Vars)'}`);
  console.log(`- SQLite Mode: Enabled (Data: ${DATA_DIR})`);
});
