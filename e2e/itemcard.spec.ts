import { test, expect } from '@playwright/test';

test('Agent 카테고리 — 카드에 file path 버튼이 없어야 한다', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280');
  await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });

  // Click Agent category
  await page.locator('text=Agent').first().click();
  await page.waitForTimeout(1000);

  // "Show file path" button should not exist
  const showPathBtn = page.locator('text=Show file path');
  await expect(showPathBtn).toHaveCount(0);

  await page.screenshot({ path: 'e2e/screenshot-agent-cards.png', fullPage: true });
});
