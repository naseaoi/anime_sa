import { describe, expect, it } from 'vitest';
import { resolvePort, resolveTrustProxy } from './runtimeConfig.js';

describe('runtime config', () => {
  it('validates the server port', () => {
    expect(resolvePort('3001')).toBe(3001);
    expect(() => resolvePort('0')).toThrow();
    expect(() => resolvePort('70000')).toThrow();
  });

  it('validates proxy trust explicitly', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy('1')).toBe(true);
    expect(() => resolveTrustProxy('true')).toThrow();
  });
});
