import { test } from '@playwright/test';
test.setTimeout(60000);
test('세션 페이지 스크린샷', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=/Session|세션/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/screenshot-sessions.png', fullPage: true });
});
