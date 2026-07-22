import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildVercelSecurityHeaders } from './core/securityHeaders.js';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));

describe('Vercel configuration', () => {
  it('applies security headers to every route', () => {
    const headers = config.headers.find((entry) => entry.source === '/(.*)')?.headers || [];
    expect(headers).toEqual(buildVercelSecurityHeaders());
  });

  it('keeps the storage path rewrite before the SPA fallback', () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/storage/:path*',
      destination: '/api/storage'
    });
    expect(config.rewrites[1]).toEqual({ source: '/(.*)', destination: '/index.html' });
  });
});
