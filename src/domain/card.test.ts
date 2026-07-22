import { describe, expect, it } from 'vitest';
import type { CardData } from '../types';
import { createCardData, updateCardData } from './card';

const currentCard: CardData = {
  id: 'card-1',
  title: '原始标题',
  coverUrl: '',
  description: '',
  startDate: '',
  endDate: '',
  rating: 3,
  tagIds: ['anime'],
  isRecommended: false,
  isWatching: false,
  createdAt: 100,
  updatedAt: 100
};

describe('card domain', () => {
  it('为不同入口统一创建完整卡片数据', () => {
    const tagIds = ['anime'];
    const card = createCardData({ tagIds, rating: 4.5 }, {
      id: 'new-card',
      now: 200,
      defaultTitle: 'Untitled'
    });

    expect(card).toEqual({
      id: 'new-card',
      title: 'Untitled',
      coverUrl: '',
      coverVariants: undefined,
      coverLocalData: '',
      description: '',
      startDate: '',
      endDate: '',
      rating: 4.5,
      tagIds: ['anime'],
      isRecommended: false,
      isWatching: false,
      createdAt: 200,
      updatedAt: 200
    });
    expect(card.tagIds).not.toBe(tagIds);
  });

  it('更新时不能覆盖卡片身份和创建时间', () => {
    const card = updateCardData(currentCard, {
      id: 'other-card',
      title: '修改后',
      createdAt: 999,
      updatedAt: 999
    }, 300);

    expect(card.id).toBe('card-1');
    expect(card.createdAt).toBe(100);
    expect(card.updatedAt).toBe(300);
    expect(card.title).toBe('修改后');
  });

  it('修改封面 URL 时清除旧的尺寸变体', () => {
    const card = updateCardData({
      ...currentCard,
      coverUrl: 'https://old.example/cover.jpg',
      coverVariants: {
        thumb: '/api/storage/media?name=old-thumb.webp',
        card: '/api/storage/media?name=old-card.webp',
        original: 'https://old.example/cover.jpg'
      }
    }, {
      coverUrl: 'https://new.example/cover.jpg'
    }, 300);

    expect(card.coverUrl).toBe('https://new.example/cover.jpg');
    expect(card.coverVariants).toBeUndefined();
  });
});
