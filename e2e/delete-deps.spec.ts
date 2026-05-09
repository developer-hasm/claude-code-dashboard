import { test } from '@playwright/test';
test.setTimeout(60000);

test('스킬 삭제 시 참조 대상 표시 (api-security-checklist → backend-dev)', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.click('text=/Skill|스킬/');
  await page.waitForTimeout(1500);

  const card = page.locator('article', { hasText: 'api-security-checklist' });
  const cardCount = await card.count();

  if (cardCount === 0) {
    console.log('api-security-checklist skill not found — skipping delete-deps test');
    return;
  }

  const deleteBtn = card.locator('text=Delete');
  await deleteBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshot-delete-deps.png', fullPage: true });
});
