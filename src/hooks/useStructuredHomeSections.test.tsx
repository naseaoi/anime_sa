import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardData, Tag } from '../types';
import { LATEST_WINDOW_DAYS, useStructuredHomeSections, type StructuredHomeSections } from './useStructuredHomeSections';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => NOW - days * DAY;

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
  createdAt: daysAgo(1),
  updatedAt: daysAgo(1)
};

describe('useStructuredHomeSections', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderSections = async (params: {
    filteredCards: CardData[];
    sectionCardLimit?: number;
  }) => {
    const results: Array<StructuredHomeSections | null> = [];
    const Probe = () => {
      results.push(useStructuredHomeSections({
        isStructuredHome: true,
        filteredCards: params.filteredCards,
        tags,
        sectionCardLimit: params.sectionCardLimit ?? 0
      }));
      return null;
    };

    await act(async () => { create(<Probe />); });
    return results[0];
  };

  it('places a card into every matching tag section', async () => {
    const sections = await renderSections({ filteredCards: [card] });

    expect(sections?.tagSections.map((section) => section.tag.id)).toEqual(['anime', 'favorite']);
    expect(sections?.tagSections.every((section) => section.cards[0]?.id === card.id)).toBe(true);
  });

  it('keeps tag sections complete even when cards are shown elsewhere', async () => {
    const watchingCard = { ...card, id: 'watching', isWatching: true };
    const plainCard = { ...card, id: 'plain' };
    const sections = await renderSections({
      filteredCards: [watchingCard, plainCard],
      sectionCardLimit: 12
    });

    expect(sections?.watchingCards.map((item) => item.id)).toEqual(['watching']);
    sections?.tagSections.forEach((section) => {
      expect([...section.cards].map((item) => item.id).sort()).toEqual(['plain', 'watching']);
    });
  });

  it('excludes watching cards from the latest shelf and puts untagged ones first', async () => {
    const watchingCard = { ...card, id: 'watching', isWatching: true, createdAt: daysAgo(1) };
    const untaggedCard = { ...card, id: 'untagged', tagIds: [], createdAt: daysAgo(3) };
    const plainCard = { ...card, id: 'plain', createdAt: daysAgo(2) };
    const sections = await renderSections({
      filteredCards: [watchingCard, plainCard, untaggedCard],
      sectionCardLimit: 12
    });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['untagged', 'plain']);
  });

  it('keeps recommended cards in the latest shelf', async () => {
    const recommendedCard = { ...card, id: 'recommended', isRecommended: true, createdAt: daysAgo(1) };
    const plainCard = { ...card, id: 'plain', createdAt: daysAgo(2) };
    const sections = await renderSections({
      filteredCards: [recommendedCard, plainCard],
      sectionCardLimit: 12
    });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['recommended', 'plain']);
  });

  it('orders the latest shelf by creation time regardless of the incoming sort', async () => {
    const oldest = { ...card, id: 'oldest', createdAt: daysAgo(3) };
    const newest = { ...card, id: 'newest', createdAt: daysAgo(1) };
    const middle = { ...card, id: 'middle', createdAt: daysAgo(2) };
    const sections = await renderSections({
      filteredCards: [oldest, middle, newest],
      sectionCardLimit: 12
    });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['newest', 'middle', 'oldest']);
    expect(sections?.tagSections[0]?.cards.map((item) => item.id)).toEqual(['oldest', 'middle', 'newest']);
  });

  it('caps the latest shelf at the section limit', async () => {
    const cards = Array.from({ length: 5 }, (_, index) => ({ ...card, id: `card-${index}` }));
    const sections = await renderSections({ filteredCards: cards, sectionCardLimit: 2 });

    expect(sections?.topCards).toHaveLength(2);
    expect(sections?.tagSections[0]?.cards).toHaveLength(5);
  });

  it('drops tagged cards created outside the latest window', async () => {
    const staleCard = { ...card, id: 'stale', createdAt: daysAgo(LATEST_WINDOW_DAYS + 1) };
    const freshCard = { ...card, id: 'fresh', createdAt: daysAgo(1) };
    const sections = await renderSections({
      filteredCards: [staleCard, freshCard],
      sectionCardLimit: 12
    });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['fresh']);
    expect(sections?.tagSections[0]?.cards.map((item) => item.id)).toEqual(['stale', 'fresh']);
  });

  it('hides the latest shelf when nothing was created in the window', async () => {
    const staleCards = Array.from({ length: 3 }, (_, index) => ({
      ...card,
      id: `stale-${index}`,
      createdAt: daysAgo(LATEST_WINDOW_DAYS + index + 1)
    }));
    const sections = await renderSections({ filteredCards: staleCards, sectionCardLimit: 12 });

    expect(sections?.topCards).toEqual([]);
    expect(sections?.tagSections[0]?.cards).toHaveLength(3);
  });

  it('keeps untagged cards in the latest shelf regardless of the window', async () => {
    const staleUntagged = { ...card, id: 'untagged', tagIds: [], createdAt: daysAgo(LATEST_WINDOW_DAYS * 10) };
    const sections = await renderSections({ filteredCards: [staleUntagged], sectionCardLimit: 12 });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['untagged']);
  });

  it('sinks cards already shown above to the end of their tag sections', async () => {
    const staleA = { ...card, id: 'stale-a', createdAt: daysAgo(30) };
    const staleB = { ...card, id: 'stale-b', createdAt: daysAgo(40) };
    const freshCard = { ...card, id: 'fresh', createdAt: daysAgo(1) };
    const watchingCard = { ...card, id: 'watching', isWatching: true, createdAt: daysAgo(50) };
    const sections = await renderSections({
      filteredCards: [watchingCard, freshCard, staleA, staleB],
      sectionCardLimit: 12
    });

    expect(sections?.topCards.map((item) => item.id)).toEqual(['fresh']);
    expect(sections?.tagSections[0]?.cards.map((item) => item.id)).toEqual(['stale-a', 'stale-b', 'watching', 'fresh']);
  });
});
