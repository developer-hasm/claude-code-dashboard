import { test } from '@playwright/test';
test.setTimeout(60000);
test('스킬 카테고리 스크린샷', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=/Skill|스킬/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshot-skills.png', fullPage: true });
});
