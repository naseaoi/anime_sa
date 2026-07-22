import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));

describe('Vercel configuration', () => {
  it('applies security headers to every route', () => {
    const headers = config.headers.find((entry) => entry.source === '/(.*)')?.headers || [];
    const values = new Map(headers.map((entry) => [entry.key, entry.value]));

    expect(values.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(values.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(values.get('X-Content-Type-Options')).toBe('nosniff');
    expect(values.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('keeps the storage path rewrite before the SPA fallback', () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/storage/:path*',
      destination: '/api/storage'
    });
    expect(config.rewrites[1]).toEqual({ source: '/(.*)', destination: '/index.html' });
  });
});
