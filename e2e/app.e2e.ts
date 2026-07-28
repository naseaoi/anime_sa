import { expect, test } from '@playwright/test';

test('public and administrator routes preserve navigation behavior', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('我的收藏');

  const search = page.getByPlaceholder('搜索标题或简介');
  await search.fill('route-check');
  await expect(page).toHaveURL(/\?q=route-check$/);
  await search.fill('');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/missing-section');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/anime/missing-card');
  await expect(page.getByText('该档案不存在或已被移除')).toBeVisible();

  await page.goto('/card/missing-card');
  await expect(page.getByText('该档案不存在或已被移除')).toBeVisible();

  await page.goto('/too/many/segments');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/tattoo');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/tat');
  await expect(page.getByRole('heading', { name: '后台管理登录' })).toBeVisible();
  await page.getByLabel('账号').fill('e2e_admin');
  await page.getByRole('textbox', { name: '密码' }).fill('e2e_password');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page.getByText('卡片管理')).toBeVisible();
  await expect(page).toHaveURL(/\/tat\/cards$/);

  const writeResult = await page.evaluate(async () => {
    const currentResponse = await fetch('/api/storage?key=public_data', { credentials: 'include' });
    const current = await currentResponse.json();
    const now = Date.now();
    const base = current || {
      version: 0,
      updatedAt: 0,
      revision: 'legacy:0',
      settings: {
        title: '我的收藏',
        iconUrl: '/icon.png',
        themeColor: '#c78c2b',
        footerText: 'All rights reserved',
        footerLeft: '© 2026',
        footerRight: 'All rights reserved'
      },
      tags: [],
      cards: []
    };
    const tag = base.tags.find((item: { slug?: string }) => item.slug === 'anime') || {
      id: 'e2e-anime',
      name: '番剧',
      slug: 'anime',
      icon: 'tv'
    };
    const tags = base.tags.some((item: { id: string }) => item.id === tag.id) ? base.tags : [...base.tags, tag];
    const card = {
      id: 'e2e-route-card',
      title: '路由回归卡片',
      coverUrl: '',
      description: '路由回归验证',
      startDate: '',
      endDate: '',
      rating: 4.5,
      tagIds: [tag.id],
      isRecommended: false,
      isWatching: false,
      createdAt: now,
      updatedAt: now
    };
    const cards = [...base.cards.filter((item: { id: string }) => item.id !== card.id), card];
    const response = await fetch('/api/storage?key=public_data', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Expected-Revision': base.revision
      },
      body: JSON.stringify({ ...base, tags, cards, updatedAt: now })
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  });
  expect(writeResult, writeResult.body).toMatchObject({ ok: true, status: 200 });

  await page.goto('/anime/e2e-route-card');
  await expect(page.getByRole('heading', { name: '路由回归卡片' })).toBeVisible();
  await page.evaluate(() => window.history.replaceState({ from: '/?q=history-state' }, '', window.location.href));
  await page.getByRole('button', { name: '返回' }).click();
  await expect(page).toHaveURL(/\/\?q=history-state$/);

  await page.goto('/card/e2e-route-card');
  await expect(page.getByRole('heading', { name: '路由回归卡片' })).toBeVisible();

  await page.goto('/?q=before-back');
  await page.evaluate(() => window.history.pushState({ searchReturnTo: '/anime/e2e-route-card' }, '', '/?q=after-back'));
  const historySearch = page.getByPlaceholder('搜索标题或简介').first();
  await expect(historySearch).toHaveValue('after-back');
  await historySearch.fill('');
  await expect(page).toHaveURL(/\/\?q=before-back$/);

  await page.goto('/tat/tags');
  await expect(page.getByRole('heading', { name: '新增标签' })).toBeVisible();
  await page.getByRole('button', { name: '数据同步' }).click();
  await expect(page).toHaveURL(/\/tat\/sync$/);
  await expect(page.getByRole('heading', { name: '存储状态' })).toBeVisible();
  await page.getByRole('button', { name: '网站设置' }).click();
  await expect(page).toHaveURL(/\/tat\/settings$/);
  await expect(page.getByRole('heading', { name: '站点信息' })).toBeVisible();

  await page.goto('/tat/unknown');
  await expect(page).toHaveURL(/\/tat\/cards$/);
});
