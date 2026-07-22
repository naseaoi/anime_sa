import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/auditStore.js', () => ({ appendAuditLog: vi.fn() }));
vi.mock('../core/kvStore.js', () => ({ ensureDb: vi.fn(() => ({})) }));
vi.mock('../core/sessionStore.js', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('../core/storageDriver.js', () => ({
  listAvailableDrivers: vi.fn(() => ['sqlite', 'redis'])
}));
vi.mock('./redisSession.js', () => ({ requireRedisAuth: vi.fn(async () => true) }));
vi.mock('./redisStore.js', () => ({
  appendRedisAudit: vi.fn(),
  getRedisClient: vi.fn(async () => ({}))
}));
vi.mock('./transfer.js', () => ({
  createRedisTransferDriver: vi.fn(),
  createSqliteTransferDriver: vi.fn(),
  transferStorageData: vi.fn(),
  transferStorageMediaBatch: vi.fn()
}));

import { handleStorageTransferApi } from './transferApi.js';

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

const createRequest = (method, body) => ({
  url: '/api/storage/transfer',
  method,
  body,
  headers: { host: 'example.test', origin: 'http://example.test' },
  socket: { remoteAddress: '127.0.0.1' }
});

describe('storage transfer API contract', () => {
  it('returns the shared method response', async () => {
    const response = createResponse();
    await handleStorageTransferApi(createRequest('DELETE'), response, { env: {}, driver: 'sqlite' });

    expect(response.statusCode).toBe(405);
    expect(response.getHeader('allow')).toBe('GET, POST');
    expect(response.json()).toEqual({ success: false, error: 'Method not allowed' });
  });

  it('rejects non-object request bodies', async () => {
    const response = createResponse();
    await handleStorageTransferApi(createRequest('POST', 'null'), response, { env: {}, driver: 'sqlite' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, error: 'JSON body must be an object' });
  });
});
