import { describe, expect, it, vi } from 'vitest';
import { createStorageApiHandler } from './storageApiHandler.js';

const createResponse = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: Buffer.alloc(0),
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    end(value = '') { this.body = Buffer.from(String(value)); },
    json() { return JSON.parse(this.body.toString('utf8') || '{}'); }
  };
};

const createRequest = (headers = {}) => ({
  url: '/api/storage?key=public_data',
  method: 'POST',
  body: JSON.stringify({ settings: { title: '收藏', iconUrl: '' }, tags: [], cards: [], updatedAt: 1 }),
  headers: { host: 'example.test', origin: 'http://example.test', ...headers },
  socket: { remoteAddress: '127.0.0.1' }
});

const createHandler = (savePublic) => createStorageApiHandler({
  driver: 'sqlite',
  getContext: async () => ({}),
  auth: { require: async () => true },
  data: { savePublic },
  media: {},
  credentials: {},
  audit: { append: vi.fn() }
});

describe('public data revision API', () => {
  it('requires a revision and replaces it with a server-generated value', async () => {
    const savePublic = vi.fn(async (_context, value, expectedRevision) => {
      expect(expectedRevision).toBe('legacy:1');
      expect(value.revision).not.toBe('legacy:1');
      return { success: true };
    });
    const response = createResponse();

    await createHandler(savePublic)(createRequest({ 'x-expected-revision': 'legacy:1' }), response);

    expect(response.statusCode).toBe(200);
    expect(response.json().revision).not.toBe('legacy:1');
    expect(savePublic).toHaveBeenCalledTimes(1);
  });

  it('rejects writes without a revision before calling the driver', async () => {
    const savePublic = vi.fn();
    const response = createResponse();

    await createHandler(savePublic)(createRequest(), response);

    expect(response.statusCode).toBe(400);
    expect(savePublic).not.toHaveBeenCalled();
  });
});
