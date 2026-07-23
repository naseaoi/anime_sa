import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { CardData, Tag } from '../types';
import { useStructuredHomeSections, type StructuredHomeSections } from './useStructuredHomeSections';

const tags: Tag[] = [
  { id: 'anime', name: '番剧' },
  { id: 'favorite', name: '收藏' }
];

const card: CardData = {
  id: 'card-1',
  title: '多标签卡片',
  coverUrl: '',
  description: '',
  startDate: '',
  endDate: '',
  rating: 4,
  tagIds: ['anime', 'favorite'],
  isRecommended: false,
  isWatching: false,
  createdAt: 1,
  updatedAt: 1
};

describe('useStructuredHomeSections', () => {
  it('places a card into every matching tag section', async () => {
    const results: Array<StructuredHomeSections | null> = [];
    const Probe = () => {
      results.push(useStructuredHomeSections({
        isStructuredHome: true,
        heroCards: [],
        filteredCards: [card],
        tags,
        sectionCardLimit: 0
      }));
      return null;
    };

    await act(async () => { create(<Probe />); });

    expect(results[0]?.tagSections.map((section) => section.tag.id)).toEqual(['anime', 'favorite']);
    expect(results[0]?.tagSections.every((section) => section.cards[0]?.id === card.id)).toBe(true);
  });
});
