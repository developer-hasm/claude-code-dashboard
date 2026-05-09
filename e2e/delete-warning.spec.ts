import { test, expect } from '@playwright/test';
test.setTimeout(60000);

test('의존성 있는 에이전트 삭제 시 경고 표시', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Go to Agent category
  await page.click('text=/Agent|에이전트/');
  await page.waitForTimeout(1500);

  // Find backend-dev card and click its Delete button
  const card = page.locator('article', { hasText: 'backend-dev' });
  const deleteBtn = card.locator('text=Delete');
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshot-delete-warning.png', fullPage: true });

    // Should see dependents warning
    const warning = page.locator('text=/depend|의존/');
    await expect(warning).toBeVisible({ timeout: 3000 });
  }
});
