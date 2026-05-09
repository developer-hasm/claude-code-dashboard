import { test } from '@playwright/test';
test.setTimeout(60000);
test('Plugin 페이지 스크린샷', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=/Plugin|플러그인/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshot-plugin.png', fullPage: true });
});
