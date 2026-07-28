import { describe, expect, it } from 'vitest';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { resolveInitialShelfKey, resolveShelfEagerCount } from './PublicStructuredHome';

const emptySections = (): StructuredHomeSections => ({
  topCards: [],
  recommendedCards: [],
  watchingCards: [],
  tagSections: []
});

describe('public structured home resource priority', () => {
  it('selects the first rendered shelf', () => {
    const sections = emptySections();
    sections.recommendedCards = [{ id: 'recommended' } as StructuredHomeSections['recommendedCards'][number]];
    sections.tagSections = [{ tag: { id: 'anime', name: '番剧' }, cards: [] }];

    expect(resolveInitialShelfKey(sections)).toBe('recommended');
  });

  it('only eagerly loads the first shelf when Hero is absent', () => {
    expect(resolveShelfEagerCount(false, 'top', 'top')).toBe(2);
    expect(resolveShelfEagerCount(false, 'recommended', 'top')).toBe(0);
    expect(resolveShelfEagerCount(true, 'top', 'top')).toBe(0);
  });
});
