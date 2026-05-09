import { test, expect } from '@playwright/test';

test('데스크탑에서 모바일 탭바가 숨겨져야 한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Desktop sidebar should be visible
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();

  // Mobile tab bar (md:hidden) should NOT be visible on desktop
  const mobileBar = page.locator('.md\\:hidden');
  const count = await mobileBar.count();
  for (let i = 0; i < count; i++) {
    const el = mobileBar.nth(i);
    const visible = await el.isVisible();
    expect(visible).toBe(false);
  }

  await page.screenshot({ path: 'e2e/screenshot-sidebar-fixed.png', fullPage: true });
});
