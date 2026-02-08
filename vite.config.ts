import { defineConfig, loadEnv, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let dbInstance: ReturnType<typeof Database> | null = null;

const SESSION_COOKIE = 'tat_session';
const BODY_LIMIT_BYTES = 1024 * 1024;

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
  const creds = { username, password };
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

const resolveAdminCredentials = async (db: ReturnType<typeof Database>, env: Record<string, string>) => {
  const mode = getStorageMode(db);
  if (mode === 'webdav') {
    try {
      const webdavCreds = await fetchWebDavJson(env, 'private_data.json');
      if (webdavCreds?.username && webdavCreds?.password) {
        return { creds: webdavCreds };
      }
    } catch {
      return { error: 'WebDAV 凭据读取失败，请检查配置' };
    }
  }

  const sqliteCreds = dbGetJson(db, 'private_data');
  if (sqliteCreds?.username && sqliteCreds?.password) {
    return { creds: sqliteCreds };
  }

  const seeded = ensureSqliteAdminFromEnv(db);
  if (seeded) return { creds: seeded };

  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
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

        if (body.username === resolved.creds.username && body.password === resolved.creds.password) {
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
