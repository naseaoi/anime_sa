import { describe, expect, it } from 'vitest';
import {
  errorResponse,
  getStaticCacheControl,
  getClientIp,
  methodNotAllowed,
  parseRequestUrl,
  readBoundedInteger,
  readJsonObject
} from './httpUtils.js';

const createRequest = (headers = {}) => ({
  headers,
  socket: { remoteAddress: '127.0.0.1' }
});

describe('HTTP utilities', () => {
  it('ignores proxy headers unless the proxy is trusted', () => {
    const request = createRequest({ 'x-real-ip': '203.0.113.5' });

    expect(getClientIp(request, {})).toBe('127.0.0.1');
    expect(getClientIp(request, { TRUST_PROXY: '1' })).toBe('203.0.113.5');
    expect(getClientIp(request, {}, true)).toBe('203.0.113.5');
  });

  it('sanitizes trusted proxy values', () => {
    expect(getClientIp(createRequest({ 'x-real-ip': '203.0.113.5\nspoofed' }), {}, true)).toBe('203.0.113.5spoofed');
  });

  it('returns bounded integers with a stable fallback', () => {
    expect(readBoundedInteger('12.8', 50, 1, 200)).toBe(12);
    expect(readBoundedInteger('bad', 50, 1, 200)).toBe(50);
    expect(readBoundedInteger(null, 50, 1, 200)).toBe(50);
    expect(readBoundedInteger('', 50, 1, 200)).toBe(50);
    expect(readBoundedInteger('999', 50, 1, 200)).toBe(200);
  });

  it('parses request paths without trusting the Host header', () => {
    expect(parseRequestUrl('/api/storage?key=ready')?.pathname).toBe('/api/storage');
    expect(parseRequestUrl('http://[')).toBeNull();
  });

  it('only gives immutable caching to fingerprinted assets', () => {
    expect(getStaticCacheControl('/assets/index-abc123.js')).toBe('public, max-age=31536000, immutable');
    expect(getStaticCacheControl('/bootstrap.js')).toBe('no-cache');
    expect(getStaticCacheControl('/site.webmanifest')).toBe('no-cache');
    expect(getStaticCacheControl('/index.html')).toBe('no-cache');
  });

  it('parses JSON objects and rejects other JSON values', async () => {
    await expect(readJsonObject({ body: '{"title":"ok"}' })).resolves.toEqual({
      ok: true,
      data: { title: 'ok' }
    });
    await expect(readJsonObject({ body: 'null' })).resolves.toEqual({
      ok: false,
      error: 'JSON body must be an object'
    });
    await expect(readJsonObject({ body: '{' })).resolves.toEqual({
      ok: false,
      error: 'Invalid JSON body'
    });
  });

  it('returns a JSON 405 response with the allowed methods', () => {
    const headers = new Map();
    const response = {
      setHeader(name, value) { headers.set(name, value); },
      end(value) { this.body = value; }
    };

    methodNotAllowed(response, ['GET', 'POST']);

    expect(response.statusCode).toBe(405);
    expect(headers.get('Allow')).toBe('GET, POST');
    expect(JSON.parse(response.body)).toEqual({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' });
  });

  it('keeps extra error details while enforcing the failure shape', () => {
    const response = {
      setHeader() {},
      end(value) { this.body = value; }
    };

    errorResponse(response, 429, 'Too many requests', { retryAfterSec: 10 });

    expect(JSON.parse(response.body)).toEqual({
      success: false,
      code: 'RATE_LIMITED',
      error: 'Too many requests',
      retryAfterSec: 10
    });
  });
});
