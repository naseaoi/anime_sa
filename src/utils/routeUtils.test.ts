import { describe, expect, it } from 'vitest';
import {
  buildSectionPath,
  getTagSlug,
  normalizeTagSlug,
  resolveLegacySection,
  resolveSectionTag,
  sectionFromCard,
  slugifyName
} from './routeUtils';
import type { CardData, Tag } from '../types';

const makeTag = (overrides: Partial<Tag>): Tag => ({ id: 't1', name: '番剧', ...overrides } as Tag);

describe('slugifyName', () => {
  it('保留中文等 Unicode 字符', () => {
    expect(slugifyName('番剧')).toBe('番剧');
    expect(slugifyName('  Sci-Fi 科幻!  ')).toBe('sci-fi-科幻');
  });

  it('无可用字符时返回空串', () => {
    expect(slugifyName('!!!')).toBe('');
  });
});

describe('normalizeTagSlug', () => {
  it('退化存量 slug "tag" 回退按名称重算', () => {
    expect(normalizeTagSlug('tag', '番剧')).toBe('番剧');
  });

  it('保留字追加 -tag 后缀', () => {
    expect(normalizeTagSlug(undefined, 'watching')).toBe('watching-tag');
  });

  it('有效自定义 slug 优先于名称', () => {
    expect(normalizeTagSlug('anime', '番剧')).toBe('anime');
  });
});

describe('getTagSlug', () => {
  it('不同中文标签得到不同 slug', () => {
    const a = getTagSlug(makeTag({ id: 'a', name: '番剧', slug: 'tag' }));
    const b = getTagSlug(makeTag({ id: 'b', name: '游戏', slug: 'tag' }));
    expect(a).toBe('番剧');
    expect(b).toBe('游戏');
    expect(a).not.toBe(b);
  });

  it('名称也退化时用 tag-{id} 保证唯一', () => {
    const a = getTagSlug(makeTag({ id: 'a', name: '🎬' }));
    const b = getTagSlug(makeTag({ id: 'b', name: '🎮' }));
    expect(a).toBe('tag-a');
    expect(b).toBe('tag-b');
  });
});

describe('sectionFromCard', () => {
  it('uses the first tag as the canonical section for a multi-tag card', () => {
    const card = { tagIds: ['favorite', 'anime'] } as CardData;
    const tags = [
      makeTag({ id: 'anime', name: '番剧' }),
      makeTag({ id: 'favorite', name: '收藏' })
    ];

    expect(sectionFromCard(card, tags)).toBe('收藏');
  });
});

describe('section resolution', () => {
  const tags = [
    makeTag({ id: 'anime', name: '番剧' }),
    makeTag({ id: 'game', name: '游戏' })
  ];

  it('uses one resolver for special, tag and invalid sections', () => {
    expect(resolveSectionTag(undefined, tags)).toBe('all');
    expect(resolveSectionTag('recommended', tags)).toBe('recommended');
    expect(resolveSectionTag('番剧', tags)).toBe('anime');
    expect(resolveSectionTag('missing', tags)).toBeNull();
  });

  it('builds canonical section paths', () => {
    expect(buildSectionPath('all', tags)).toBe('/');
    expect(buildSectionPath('watching', tags)).toBe('/watching');
    expect(buildSectionPath('anime', tags)).toBe('/番剧');
    expect(buildSectionPath('missing', tags)).toBe('/');
  });

  it('resolves legacy tag ids and slugs to canonical sections', () => {
    expect(resolveLegacySection('recommended', tags)).toBe('recommended');
    expect(resolveLegacySection('anime', tags)).toBe('番剧');
    expect(resolveLegacySection('番剧', tags)).toBe('番剧');
    expect(resolveLegacySection('missing', tags)).toBeNull();
  });
});
