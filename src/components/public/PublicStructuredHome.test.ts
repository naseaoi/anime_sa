import { describe, expect, it } from 'vitest';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { resolveInitialShelfKey, resolveShelfEagerCount } from './PublicStructuredHome';

const emptySections = (): StructuredHomeSections => ({
  topCards: [],
  watchingCards: [],
  tagSections: []
});

describe('public structured home resource priority', () => {
  it('selects the first rendered shelf', () => {
    const sections = emptySections();
    sections.watchingCards = [{ id: 'watching' } as StructuredHomeSections['watchingCards'][number]];
    sections.topCards = [{ id: 'top' } as StructuredHomeSections['topCards'][number]];
    sections.tagSections = [{ tag: { id: 'anime', name: '番剧' }, cards: [] }];

    expect(resolveInitialShelfKey(sections)).toBe('watching');
  });

  it('falls back to the latest shelf when nothing is being watched', () => {
    const sections = emptySections();
    sections.topCards = [{ id: 'top' } as StructuredHomeSections['topCards'][number]];

    expect(resolveInitialShelfKey(sections)).toBe('top');
  });

  it('only eagerly loads the first shelf when Hero is absent', () => {
    expect(resolveShelfEagerCount(false, 'watching', 'watching')).toBe(2);
    expect(resolveShelfEagerCount(false, 'top', 'watching')).toBe(0);
    expect(resolveShelfEagerCount(true, 'watching', 'watching')).toBe(0);
  });
});
