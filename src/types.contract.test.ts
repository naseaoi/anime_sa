import { describe, expectTypeOf, it } from 'vitest';
import { normalizePublicDataPayload } from '../shared/publicDataSchema.js';
import type { CardData, PublicData, SiteSettings, Tag } from './types';

describe('public data type contract', () => {
  it('derives client types from the runtime normalizer', () => {
    expectTypeOf<CardData>().not.toBeAny();
    expectTypeOf<Tag>().not.toBeAny();
    expectTypeOf<SiteSettings>().not.toBeAny();
    expectTypeOf(normalizePublicDataPayload).returns.toEqualTypeOf<PublicData | null>();
  });
});
