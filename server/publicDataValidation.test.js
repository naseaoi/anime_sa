import { describe, expect, it } from 'vitest';
import { getPublicDataUpdatedAt, normalizePublicDataPayload } from './publicDataValidation.js';

const createData = () => ({
  settings: {
    title: '收藏',
    iconUrl: 'https://example.com/icon.png',
    themeColor: '#c78c2b'
  },
  tags: [{ id: 'anime', name: '番剧', slug: 'anime' }],
  cards: [{
    id: 'card-1',
    title: '标题',
    coverUrl: '/api/sqlite/media?name=card.webp',
    description: '',
    startDate: '',
    endDate: '',
    rating: 4.5,
    tagIds: ['anime'],
    isRecommended: true,
    createdAt: 10,
    updatedAt: 20
  }]
});

describe('public data validation', () => {
  it('normalizes valid data and derives its version', () => {
    const result = normalizePublicDataPayload(createData());
    expect(result).not.toBeNull();
    expect(result.updatedAt).toBe(20);
    expect(getPublicDataUpdatedAt(result)).toBe(20);
  });

  it('accepts legacy cards without coverUrl', () => {
    const data = createData();
    delete data.cards[0].coverUrl;
    expect(normalizePublicDataPayload(data)?.cards[0].coverUrl).toBe('');
  });

  it('rejects unsafe urls and invalid tag references', () => {
    const unsafeUrlData = createData();
    unsafeUrlData.cards[0].coverUrl = 'javascript:alert(1)';
    expect(normalizePublicDataPayload(unsafeUrlData)).toBeNull();

    const missingTagData = createData();
    missingTagData.cards[0].tagIds = ['missing'];
    expect(normalizePublicDataPayload(missingTagData)).toBeNull();
  });
});
