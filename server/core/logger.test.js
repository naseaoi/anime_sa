import { describe, expect, it, vi } from 'vitest';
import { instrumentResponse, shouldLogHttpRequest } from './logger.js';

describe('HTTP request logging', () => {
  it('logs APIs, errors and slow requests while skipping successful assets and media', () => {
    expect(shouldLogHttpRequest({ url: '/api/storage?key=public_data' }, 200, 10)).toBe(true);
    expect(shouldLogHttpRequest({ url: '/assets/app.js' }, 200, 10)).toBe(false);
    expect(shouldLogHttpRequest({ url: '/api/storage/media?name=a.webp' }, 200, 10)).toBe(false);
    expect(shouldLogHttpRequest({ url: '/assets/missing.js' }, 404, 10)).toBe(true);
    expect(shouldLogHttpRequest({ url: '/assets/app.js' }, 200, 1000)).toBe(true);
  });

  it('keeps request IDs without logging successful static responses', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const headers = new Map();
    const response = {
      statusCode: 200,
      setHeader(name, value) { headers.set(name, value); },
      end: vi.fn()
    };

    instrumentResponse({ method: 'GET', url: '/assets/app.js' }, response, 'request-1', Date.now(), 'sqlite');
    response.end();

    expect(headers.get('X-Request-Id')).toBe('request-1');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
