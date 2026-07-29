import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { shouldOverlayPublicTopNav } from './PublicNavigationContext';
import { PublicTopNav } from './PublicTopNav';

describe('public top navigation layout', () => {
  it('only overlays home content when a Hero is rendered', () => {
    expect(shouldOverlayPublicTopNav({
      isDetail: false,
      pathname: '/',
      searchTerm: '',
      recommendedCount: 1
    })).toBe(true);
    expect(shouldOverlayPublicTopNav({
      isDetail: false,
      pathname: '/',
      searchTerm: '搜索内容',
      recommendedCount: 1
    })).toBe(false);
    expect(shouldOverlayPublicTopNav({
      isDetail: false,
      pathname: '/',
      searchTerm: '',
      recommendedCount: 0
    })).toBe(false);
  });

  it('places contextual actions before persistent actions', () => {
    const markup = renderToStaticMarkup(
      <PublicTopNav
        iconUrl=""
        title="测试站点"
        tags={[]}
        activeTag="all"
        totalCards={0}
        cardStats={{ recommendedCount: 0, watchingCount: 0, tagCountMap: new Map() }}
        onTagChange={vi.fn()}
        searchTerm=""
        onSearchChange={vi.fn()}
        onClearSearch={vi.fn()}
        sortKey="createdAt"
        sortOrder="desc"
        onSortChange={vi.fn()}
        isAdmin
        onCreateClick={vi.fn()}
        theme="system"
        toggleTheme={vi.fn()}
      />
    );

    expect(markup.indexOf('title="快速添加"')).toBeLessThan(markup.indexOf('placeholder="搜索标题或简介"'));
    expect(markup.indexOf('title="快速添加"')).toBeLessThan(markup.indexOf('title="主题"'));
  });
});
