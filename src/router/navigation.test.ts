import { describe, expect, it } from 'vitest';
import { assertInternalRouteTarget, isAdminRoutePath, isInternalRouteTarget } from './navigation';

describe('router navigation', () => {
  it('accepts internal absolute paths with search and hash values', () => {
    expect(isInternalRouteTarget('/')).toBe(true);
    expect(isInternalRouteTarget('/anime/card-1?q=test#details')).toBe(true);
    expect(assertInternalRouteTarget('/tat/cards')).toBe('/tat/cards');
  });

  it('rejects external, relative and malformed targets', () => {
    for (const target of ['https://example.com', '//example.com', 'tat/cards', '/\\example.com', '/path\nnext']) {
      expect(isInternalRouteTarget(target)).toBe(false);
      expect(() => assertInternalRouteTarget(target)).toThrow('internal absolute path');
    }
  });

  it('matches only the administrator route boundary', () => {
    expect(isAdminRoutePath('/tat')).toBe(true);
    expect(isAdminRoutePath('/tat/cards')).toBe(true);
    expect(isAdminRoutePath('/tattoo')).toBe(false);
    expect(isAdminRoutePath('/tat-archive')).toBe(false);
  });
});
