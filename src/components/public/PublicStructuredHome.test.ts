import { describe, expect, it } from 'vitest';
import { resolveShelfEagerCount, shouldDeferShelf } from './PublicStructuredHome';

describe('public structured home resource priority', () => {
  it('prioritizes shelves that can enter the first viewport', () => {
    expect(resolveShelfEagerCount(false, 0)).toBe(2);
    expect(resolveShelfEagerCount(false, 1)).toBe(0);
    expect(resolveShelfEagerCount(true, 0)).toBe(1);
    expect(resolveShelfEagerCount(true, 1)).toBe(1);
    expect(resolveShelfEagerCount(true, 2)).toBe(0);
  });

  it('defers shelves after the first two', () => {
    expect(shouldDeferShelf(0)).toBe(false);
    expect(shouldDeferShelf(1)).toBe(false);
    expect(shouldDeferShelf(2)).toBe(true);
  });
});
