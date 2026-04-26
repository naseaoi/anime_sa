import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  handleSqliteApi,
  handleWebDavApi,
  jsonResponse,
  getClientIp
} from './server/core/apiCore.js';

// ===== 环境变量加载 =====
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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 速率限制阈值
const API_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const API_RATE_LIMIT_MAX = 600;
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 20;

// ===== 静态资源 =====

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

const isCompressibleType = (contentType) =>
  contentType.startsWith('text/') ||
  contentType.includes('javascript') ||
  contentType.includes('json') ||
  contentType.includes('xml') ||
  contentType.includes('svg');

const createWeakEtag = (stat) => `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

// 静态文件 stat 缓存：dist 产物带 hash 不会被改写，缓存几秒可在并发时避免重复 syscall
// index.html 走 no-cache 响应头，5s 内 mtime 抖动也不会引发功能问题
const STAT_CACHE_TTL_MS = 5000;
const statCache = new Map();

const getCachedStat = async (filePath) => {
  const now = Date.now();
  const cached = statCache.get(filePath);
  if (cached && cached.exp > now) return cached;

  try {
    const stat = await fs.promises.stat(filePath);
    const entry = { stat, isDirectory: stat.isDirectory(), missing: false, exp: now + STAT_CACHE_TTL_MS };
    statCache.set(filePath, entry);
    return entry;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const entry = { stat: null, isDirectory: false, missing: true, exp: now + STAT_CACHE_TTL_MS };
      statCache.set(filePath, entry);
      return entry;
    }
    throw err;
  }
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

// ===== 速率限制（按 IP+scope 计数，窗口过期自动清理） =====

const rateLimitStore = new Map();

const cleanupRateLimitStore = (now) => {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) rateLimitStore.delete(key);
  }
};

// 周期清理：原本只在每次 checkRateLimit 进来时懒清，冷门 scope 会永久留着。每 5 分钟跑一次足够。
setInterval(() => {
  cleanupRateLimitStore(Date.now());
}, 5 * 60 * 1000).unref();

const checkRateLimit = (req, res, scope, max, windowMs) => {
  const now = Date.now();
  cleanupRateLimitStore(now);

  const key = `${scope}:${getClientIp(req)}`;
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

// ===== 通用安全响应头 =====
// CSP 说明：
// - img-src 放宽到 https/http/data/blob —— 用户可填外链作为封面
// - style-src/font-src 放行 Google Fonts（index.html link 引用）
// - script-src 暂用 'unsafe-inline'：index.html 顶部需在 paint 前应用主题与标题，无法走 nonce
// - HSTS 仅生产开启（dev 经 vite 走 http localhost）
const CSP_HEADER_VALUE = [
  "default-src 'self'",
  "img-src 'self' data: blob: https: http:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

const setSecurityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', CSP_HEADER_VALUE);
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
};

// ===== HTTP 服务器 =====

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  // /api/webdav
  if (url.pathname.startsWith('/api/webdav')) {
    if (!checkRateLimit(req, res, 'api:webdav', API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS)) return;
    await handleWebDavApi(req, res, { env: process.env });
    return;
  }

  // /api/sqlite/*：登录独立更严格限流
  if (url.pathname.startsWith('/api/sqlite')) {
    const scope = url.pathname.endsWith('/login') ? 'api:login' : 'api:sqlite';
    const max = scope === 'api:login' ? LOGIN_RATE_LIMIT_MAX : API_RATE_LIMIT_MAX;
    const window = scope === 'api:login' ? LOGIN_RATE_LIMIT_WINDOW_MS : API_RATE_LIMIT_WINDOW_MS;
    if (!checkRateLimit(req, res, scope, max, window)) return;
    await handleSqliteApi(req, res, { env: process.env, isProduction: IS_PRODUCTION });
    return;
  }

  // 静态文件（SPA fallback 到 index.html）
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  let entry = await getCachedStat(filePath);
  if (entry.missing || entry.isDirectory) {
    filePath = path.join(DIST_DIR, 'index.html');
    entry = await getCachedStat(filePath);
  }
  if (entry.missing) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileStat = entry.stat;

  const etag = createWeakEtag(fileStat);
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', fileStat.mtime.toUTCString());
  res.setHeader('Cache-Control', filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable');

  streamWithOptionalCompression(req, res, filePath, contentType, fileStat);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`- WebDAV Mode: ${process.env.WEBDAV_URL ? 'Enabled' : 'Disabled (Missing Env Vars)'}`);
  console.log(`- SQLite Mode: Enabled (Data: ${DATA_DIR})`);
});
