import { describe, expect, it } from 'vitest';
import { handleRedisStorageApi } from './redisApi.js';

const createResponse = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: Buffer.alloc(0),
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value)); },
    json() { return JSON.parse(this.body.toString('utf8') || '{}'); }
  };
};

const createRequest = (url, method = 'GET') => ({
  url,
  method,
  headers: { host: 'example.test' },
  socket: { remoteAddress: '127.0.0.1' }
});

describe('Vercel API runtime', () => {
  it('reports the Redis storage driver without connecting', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=driver'), response, { env: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ driver: 'redis' });
  });

  it('reports a Vercel health response without Redis', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=ping'), response, { env: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, driver: 'redis', runtime: 'vercel' });
  });
});
