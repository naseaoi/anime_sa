import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(async () => ({ allowed: true })),
  getRedisClient: vi.fn(async () => ({})),
  readRedisJson: vi.fn(async () => ({
    settings: { title: '收藏', iconUrl: '', themeColor: '#c78c2b' },
    tags: [{ id: 'anime', name: '番剧', slug: 'anime' }],
    cards: [],
    updatedAt: 1
  }))
}));

vi.mock('./redisStore.js', async (importOriginal) => ({
  ...(await importOriginal()),
  consumeRateLimit: redisMocks.consumeRateLimit,
  getRedisClient: redisMocks.getRedisClient,
  readRedisJson: redisMocks.readRedisJson
}));
import { handleRedisStorageApi } from './redisApi.js';

const createResponse = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: Buffer.alloc(0),
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value)); },
    json() { return JSON.parse(this.body.toString('utf8') || '{}'); }
  };
};

const createRequest = (url, method = 'GET', body) => ({
  url,
  method,
  body,
  headers: { host: 'example.test', origin: 'http://example.test' },
  socket: { remoteAddress: '127.0.0.1' }
});

describe('Redis storage API runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.consumeRateLimit.mockResolvedValue({ allowed: true });
    redisMocks.readRedisJson.mockResolvedValue({
      settings: { title: '收藏', iconUrl: '', themeColor: '#c78c2b' },
      tags: [{ id: 'anime', name: '番剧', slug: 'anime' }],
      cards: [],
      updatedAt: 1
    });
  });

  it('reports the Redis storage driver without connecting', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=driver'), response, { env: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ driver: 'redis' });
  });

  it('reports a Vercel health response by default', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=ping'), response, { env: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, driver: 'redis', runtime: 'vercel' });
  });

  it('reports the Node runtime when requested', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=ping'), response, { env: {}, runtime: 'node' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, driver: 'redis', runtime: 'node' });
  });

  it('allows public data reads without a session', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=public_data'), response, { env: {} });

    expect(response.statusCode).toBe(200);
    expect(response.json().cards).toEqual([]);
  });

  it('returns the shared method and JSON errors', async () => {
    const methodResponse = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage?key=driver', 'POST'), methodResponse, { env: {} });
    expect(methodResponse.statusCode).toBe(405);
    expect(methodResponse.getHeader('allow')).toBe('GET');
    expect(methodResponse.json()).toEqual({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' });

    const bodyResponse = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage/login', 'POST', 'null'), bodyResponse, { env: {} });
    expect(bodyResponse.statusCode).toBe(400);
    expect(bodyResponse.json()).toEqual({ success: false, code: 'BAD_REQUEST', error: 'JSON body must be an object' });
  });

  it('returns the shared missing-key error', async () => {
    const response = createResponse();
    await handleRedisStorageApi(createRequest('/api/storage'), response, { env: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, code: 'BAD_REQUEST', error: 'Missing key parameter' });
  });
});
