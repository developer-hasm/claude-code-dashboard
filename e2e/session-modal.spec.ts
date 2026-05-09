import { test, expect } from '@playwright/test';
test.setTimeout(60000);

test('세션 Messages 클릭 → 대화내용 모달', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Go to Sessions
  await page.click('text=/Session|세션/');
  await page.waitForTimeout(2000);

  // Click the Messages pill (underlined, accent color)
  const messagesPill = page.locator('text=/Messages/').first();
  if (await messagesPill.isVisible()) {
    await messagesPill.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshot-session-modal.png', fullPage: true });

    // Modal should be visible
    const modal = page.locator('role=dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
  }
});
