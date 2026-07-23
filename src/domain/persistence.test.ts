import { describe, expect, it } from 'vitest';
import {
  conflictResult,
  failedResult,
  isPersisted,
  persistedResult,
  stagedResult
} from './persistence';

describe('persistence results', () => {
  it('keeps staged and persisted states distinct', () => {
    expect(stagedResult()).toEqual({ state: 'staged' });
    expect(isPersisted(persistedResult())).toBe(true);
    expect(isPersisted(conflictResult('conflict'))).toBe(false);
    expect(isPersisted(failedResult('failed'))).toBe(false);
  });
});
