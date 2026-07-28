import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { installResponseCompression, selectResponseEncoding } from './responseCompression.js';

const createResponse = () => {
  const headers = new Map();
  let finish;
  const completed = new Promise((resolve) => { finish = resolve; });
  return {
    headers,
    completed,
    statusCode: 200,
    body: Buffer.alloc(0),
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    end(value = '') {
      this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
      finish();
      return this;
    }
  };
};

describe('response compression', () => {
  it('selects the best supported encoding', () => {
    expect(selectResponseEncoding('gzip, br')).toBe('br');
    expect(selectResponseEncoding('br;q=0, gzip;q=0.8')).toBe('gzip');
    expect(selectResponseEncoding('identity')).toBeNull();
  });

  it('compresses a large JSON response', async () => {
    const response = createResponse();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    installResponseCompression({ method: 'GET', headers: { 'accept-encoding': 'br' } }, response);
    const body = JSON.stringify({ cards: Array.from({ length: 100 }, (_, id) => ({ id, title: '收藏条目' })) });

    response.end(body);
    await response.completed;

    expect(response.headers.get('content-encoding')).toBe('br');
    expect(response.headers.get('vary')).toContain('Accept-Encoding');
    expect(zlib.brotliDecompressSync(response.body).toString('utf8')).toBe(body);
  });

  it('does not compress image responses', async () => {
    const response = createResponse();
    response.setHeader('Content-Type', 'image/png');
    installResponseCompression({ method: 'GET', headers: { 'accept-encoding': 'br' } }, response);

    response.end(Buffer.alloc(2048));
    await response.completed;

    expect(response.headers.get('content-encoding')).toBeUndefined();
  });
});
