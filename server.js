import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  errorResponse,
  handleStorageApi
} from './server/core/apiCore.js';
import { handleRedisStorageApi } from './server/storage/redisApi.js';
import { handleStorageTransferApi } from './server/storage/transferApi.js';
import { setSecurityHeaders } from './server/core/securityHeaders.js';
import { getClientIp } from './server/core/httpUtils.js';
import { createInMemoryRateLimiter } from './server/core/rateLimit.js';
import { loadRuntimeConfig } from './server/core/runtimeConfig.js';
import { createRequestId, instrumentResponse } from './server/core/logger.js';
import { createFileStatCache } from './server/core/fileStatCache.js';
import { installResponseCompression, selectResponseEncoding } from './server/core/responseCompression.js';

const runtimeConfig = loadRuntimeConfig(process.env);
const PORT = runtimeConfig.port;
const DIST_DIR = path.join(process.cwd(), 'dist');
const DATA_DIR = runtimeConfig.dataDir;
const IS_PRODUCTION = runtimeConfig.isProduction;
const STORAGE_DRIVER = runtimeConfig.storageDriver;

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
  '.webmanifest': 'application/manifest+json',
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

const STAT_CACHE_TTL_MS = 5000;
const statCache = createFileStatCache({ ttlMs: STAT_CACHE_TTL_MS, maxEntries: 512 });
const getCachedStat = statCache.get;

const streamFile = (res, filePath) => {
  const input = fs.createReadStream(filePath);
  input.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Server Error: STREAM_READ');
      return;
    }
    res.destroy();
  });

  input.pipe(res);
};

const resolvePrecompressedAsset = async (req, filePath, contentType, stat) => {
  if (!isCompressibleType(contentType) || stat.size <= 1024) return null;
  const encoding = selectResponseEncoding(req.headers['accept-encoding']);
  if (!encoding) return null;
  const suffix = encoding === 'br' ? '.br' : '.gz';
  const encodedPath = `${filePath}${suffix}`;
  const encodedEntry = await getCachedStat(encodedPath);
  if (encodedEntry.missing || encodedEntry.isDirectory || !encodedEntry.stat) return null;
  return { encoding, filePath: encodedPath, stat: encodedEntry.stat };
};

// ===== 速率限制（按 IP+scope 计数，窗口过期自动清理） =====

const rateLimiter = createInMemoryRateLimiter();

const checkRateLimit = (req, res, scope, max, windowMs) => {
  const result = rateLimiter.check(scope, getClientIp(req), max, windowMs);
  if (!result.allowed) {
    const retryAfterSec = result.retryAfterSec;
    res.setHeader('Retry-After', String(retryAfterSec));
    errorResponse(res, 429, 'Too many requests', { retryAfterSec });
    return false;
  }
  return true;
};

// ===== HTTP 服务器 =====

const server = http.createServer(async (req, res) => {
  instrumentResponse(req, res, createRequestId(req), Date.now(), STORAGE_DRIVER);
  installResponseCompression(req, res);
  setSecurityHeaders(res, IS_PRODUCTION);
  const url = new URL(req.url || '/', `http://${req.headers.host || 'local'}`);

  if (url.pathname.startsWith('/api/storage') || url.pathname.startsWith('/api/sqlite')) {
    if (url.pathname === '/api/storage/transfer') {
      if (!checkRateLimit(req, res, 'api:storage', API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS)) return;
      await handleStorageTransferApi(req, res, { env: process.env, driver: STORAGE_DRIVER });
      return;
    }
    if (STORAGE_DRIVER === 'redis') {
      await handleRedisStorageApi(req, res, { env: process.env, isProduction: IS_PRODUCTION, runtime: 'node' });
      return;
    }
    const scope = url.pathname.endsWith('/login') ? 'api:login' : 'api:storage';
    const max = scope === 'api:login' ? LOGIN_RATE_LIMIT_MAX : API_RATE_LIMIT_MAX;
    const window = scope === 'api:login' ? LOGIN_RATE_LIMIT_WINDOW_MS : API_RATE_LIMIT_WINDOW_MS;
    if (!checkRateLimit(req, res, scope, max, window)) return;
    await handleStorageApi(req, res, { env: process.env, isProduction: IS_PRODUCTION });
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
  const encodedAsset = await resolvePrecompressedAsset(req, filePath, contentType, fileStat);
  const responsePath = encodedAsset?.filePath || filePath;
  const responseStat = encodedAsset?.stat || fileStat;
  if (encodedAsset) {
    res.setHeader('Content-Encoding', encodedAsset.encoding);
    res.setHeader('Vary', 'Accept-Encoding');
  }
  res.setHeader('Content-Length', responseStat.size);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  streamFile(res, responsePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`- Storage Driver: ${STORAGE_DRIVER === 'redis' ? 'Redis' : `SQLite (Data: ${DATA_DIR})`}`);
});
