import { expect, test } from '@playwright/test';

test('public shell loads and administrator can sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('我的收藏');

  await page.goto('/tat');
  await expect(page.getByRole('heading', { name: '后台管理登录' })).toBeVisible();
  await page.getByLabel('账号').fill('e2e_admin');
  await page.getByRole('textbox', { name: '密码' }).fill('e2e_password');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page.getByText('卡片管理')).toBeVisible();
});
