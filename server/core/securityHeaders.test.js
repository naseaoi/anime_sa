import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADER_VALUES,
  buildVercelSecurityHeaders,
  setSecurityHeaders
} from './securityHeaders.js';

describe('security headers', () => {
  it('builds Vercel entries from the shared values', () => {
    expect(buildVercelSecurityHeaders()).toEqual(
      Object.entries(SECURITY_HEADER_VALUES).map(([key, value]) => ({ key, value }))
    );
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
  });

  it('only emits HSTS for the production Node server', () => {
    const developmentResponse = { setHeader: vi.fn() };
    const productionResponse = { setHeader: vi.fn() };

    setSecurityHeaders(developmentResponse, false);
    setSecurityHeaders(productionResponse, true);

    expect(developmentResponse.setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String)
    );
    expect(productionResponse.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      SECURITY_HEADER_VALUES['Strict-Transport-Security']
    );
  });
});
