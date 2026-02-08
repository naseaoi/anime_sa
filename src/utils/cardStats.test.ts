import { describe, expect, it } from 'vitest';
import { buildCardStats } from './cardStats';
import { CardData } from '../types';

const makeCard = (overrides: Partial<CardData>): CardData => ({
  id: overrides.id || '1',
  title: overrides.title || 'title',
  coverUrl: overrides.coverUrl || '',
  description: overrides.description || '',
  startDate: overrides.startDate || '',
  endDate: overrides.endDate || '',
  rating: overrides.rating || 0,
  tagIds: overrides.tagIds || [],
  isRecommended: overrides.isRecommended || false,
  isWatching: overrides.isWatching || false,
  createdAt: overrides.createdAt || 1,
  updatedAt: overrides.updatedAt || 1
});

describe('buildCardStats', () => {
  it('returns zero stats for empty cards', () => {
    const stats = buildCardStats([]);
    expect(stats.recommendedCount).toBe(0);
    expect(stats.watchingCount).toBe(0);
    expect(stats.tagCountMap.size).toBe(0);
  });

  it('aggregates recommended, watching and tag counts', () => {
    const cards: CardData[] = [
      makeCard({ id: '1', isRecommended: true, isWatching: true, tagIds: ['a', 'b'] }),
      makeCard({ id: '2', isRecommended: true, isWatching: false, tagIds: ['a'] }),
      makeCard({ id: '3', isRecommended: false, isWatching: true, tagIds: ['b', 'c'] })
    ];

    const stats = buildCardStats(cards);
    expect(stats.recommendedCount).toBe(2);
    expect(stats.watchingCount).toBe(2);
    expect(stats.tagCountMap.get('a')).toBe(2);
    expect(stats.tagCountMap.get('b')).toBe(2);
    expect(stats.tagCountMap.get('c')).toBe(1);
  });
});
