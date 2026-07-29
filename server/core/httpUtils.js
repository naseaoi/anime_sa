import { BODY_LIMIT_BYTES } from './constants.js';

const ERROR_CODES = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE'
});

export const jsonResponse = (response, status, payload, options = {}) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', options.cacheControl || 'no-store');
  if (options.etag) response.setHeader('ETag', options.etag);
  if (!options.cacheControl || options.cacheControl === 'no-store') {
    response.setHeader('Pragma', 'no-cache');
  }
  response.end(JSON.stringify(payload));
};

export const errorResponse = (response, status, error, details = {}) => (
  jsonResponse(response, status, { ...details, success: false, code: ERROR_CODES[status] || 'REQUEST_FAILED', error })
);

export const methodNotAllowed = (response, allowedMethods) => {
  if (allowedMethods.length > 0) response.setHeader('Allow', allowedMethods.join(', '));
  return errorResponse(response, 405, 'Method not allowed');
};

export const readBody = async (request, limit = BODY_LIMIT_BYTES) => {
  if (request.body !== undefined && request.body !== null) {
    const body = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
    if (body.length > limit) {
      const error = new Error('Payload too large');
      // @ts-expect-error Application error code
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    return body;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    received += buffer.length;
    if (received > limit) {
      const error = new Error('Payload too large');
      // @ts-expect-error Application error code
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
};

export const readJsonObject = async (request, limit = BODY_LIMIT_BYTES) => {
  const rawBody = await readBody(request, limit);
  let data;
  try {
    data = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'JSON body must be an object' };
  }
  return { ok: true, data };
};

export const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = decodeURIComponent(item.slice(index + 1).trim());
    if (key) cookies[key] = value;
    return cookies;
  }, {});
};

const cleanClientIp = (value) => (
  String(value || 'unknown').trim().replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 128) || 'unknown'
);

export const getClientIp = (request, env = process.env, trustPlatformProxy = false) => {
  const remoteAddress = cleanClientIp(request.socket?.remoteAddress);
  if (!trustPlatformProxy && env?.TRUST_PROXY !== '1') return remoteAddress;

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return cleanClientIp(realIp);

  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return cleanClientIp(forwardedFor.split(',').at(-1));
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return cleanClientIp(String(forwardedFor.at(-1)).split(',').at(-1));
  }
  return remoteAddress;
};

export const readBoundedInteger = (value, fallback, min, max) => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
};

export const parseRequestUrl = (value) => {
  try {
    return new URL(String(value || '/'), 'http://local');
  } catch {
    return null;
  }
};

export const getStaticCacheControl = (pathname) => (
  String(pathname || '').startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'
);
