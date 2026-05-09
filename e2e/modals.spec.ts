import { test, expect } from '@playwright/test';
test.setTimeout(60000);

test('Export 버튼 → 모달 열림', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.click('text=/Export|내보내기/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshot-export-modal.png', fullPage: true });
  const dialog = page.locator('role=dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
});

test('Import 버튼 → 모달 열림', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.click('text=/Import|가져오기/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshot-import-modal.png', fullPage: true });
  const dialog = page.locator('role=dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
});

// Dependencies 3D 그래프 기능은 v1.1에서 제거됨 — 테스트 삭제
