import { describe, expect, it, vi } from 'vitest';
import { createStorageApiHandler } from './storageApiHandler.js';

const createResponse = () => {
  const headers = new Map();
  return {
    headers,
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

const createMediaHandler = (media) => createStorageApiHandler({
  driver: 'sqlite',
  getContext: async () => ({}),
  auth: { require: async () => true },
  data: {},
  media,
  credentials: {},
  audit: { append: vi.fn() }
});

const createPublicReadHandler = (value) => createStorageApiHandler({
  driver: 'sqlite',
  getContext: async () => ({}),
  auth: { require: async () => true },
  data: { read: vi.fn(async () => value) },
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

  it('supports public revalidation with a revision ETag', async () => {
    const value = {
      version: 1,
      updatedAt: 1,
      revision: 'revision-1',
      settings: { title: '收藏', iconUrl: '' },
      tags: [],
      cards: []
    };
    const handler = createPublicReadHandler(value);
    const first = createResponse();
    await handler({
      url: '/api/storage?key=public_data',
      method: 'GET',
      headers: { host: 'example.test' },
      socket: { remoteAddress: '127.0.0.1' }
    }, first);

    expect(first.statusCode).toBe(200);
    expect(first.headers.get('cache-control')).toBe('public, no-cache');
    expect(first.headers.get('pragma')).toBeUndefined();
    expect(first.headers.get('etag')).toMatch(/^"[A-Za-z0-9_-]{43}"$/);

    const second = createResponse();
    await handler({
      url: '/api/storage?key=public_data',
      method: 'GET',
      headers: { host: 'example.test', 'if-none-match': first.headers.get('etag') },
      socket: { remoteAddress: '127.0.0.1' }
    }, second);

    expect(second.statusCode).toBe(304);
    expect(second.body.length).toBe(0);
  });
});

describe('media cache headers', () => {
  it('serves immutable media with shared cache directives and honors ETag', async () => {
    const media = { read: vi.fn(async () => ({ contentType: 'image/webp', bytes: Buffer.from('cover') })) };
    const handler = createMediaHandler(media);
    const first = createResponse();
    await handler({
      url: '/api/storage/media?name=cover.webp',
      method: 'GET',
      headers: { host: 'example.test', origin: 'http://example.test' },
      socket: { remoteAddress: '127.0.0.1' }
    }, first);

    expect(first.statusCode).toBe(200);
    expect(first.headers.get('cache-control')).toContain('s-maxage=31536000');
    expect(first.headers.get('cache-control')).toContain('immutable');
    expect(first.headers.get('etag')).toMatch(/^"[a-f0-9]{64}"$/);

    const second = createResponse();
    await handler({
      url: '/api/storage/media?name=cover.webp',
      method: 'GET',
      headers: {
        host: 'example.test',
        origin: 'http://example.test',
        'if-none-match': first.headers.get('etag')
      },
      socket: { remoteAddress: '127.0.0.1' }
    }, second);

    expect(second.statusCode).toBe(304);
    expect(second.headers.get('etag')).toBe(first.headers.get('etag'));
  });
});
