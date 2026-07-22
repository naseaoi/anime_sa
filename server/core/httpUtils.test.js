import { describe, expect, it } from 'vitest';
import { getClientIp, readBoundedInteger } from './httpUtils.js';

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
});
