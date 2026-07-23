import { describe, expect, it, vi } from 'vitest';

vi.mock('./core/kvStore.js', () => ({
  dbDelete: vi.fn(),
  dbGetJson: vi.fn(),
  dbSetJson: vi.fn(),
  ensureDb: vi.fn(() => ({}))
}));

import { handleStorageApi } from './core/apiCore.js';

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

const createRequest = (url, method, body) => ({
  url,
  method,
  body,
  headers: { host: 'example.test', origin: 'http://example.test' },
  socket: { remoteAddress: '127.0.0.1' }
});

describe('SQLite API HTTP contract', () => {
  it('returns a JSON 405 response for a driver write', async () => {
    const response = createResponse();
    await handleStorageApi(createRequest('/api/storage?key=driver', 'POST'), response, { env: {} });

    expect(response.statusCode).toBe(405);
    expect(response.getHeader('allow')).toBe('GET');
    expect(response.json()).toEqual({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed' });
  });

  it('rejects a non-object login body before credential lookup', async () => {
    const response = createResponse();
    await handleStorageApi(createRequest('/api/storage/login', 'POST', 'null'), response, { env: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, code: 'BAD_REQUEST', error: 'JSON body must be an object' });
  });

  it('returns the shared missing-key error', async () => {
    const response = createResponse();
    await handleStorageApi(createRequest('/api/storage', 'GET'), response, { env: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, code: 'BAD_REQUEST', error: 'Missing key parameter' });
  });
});
