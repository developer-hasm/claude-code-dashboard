import { test } from '@playwright/test';
test.setTimeout(60000);

test('Hook 페이지', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=/Hook|훅/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshot-hook.png', fullPage: true });
});

test('Command 페이지', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=/Command|명령어/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshot-command.png', fullPage: true });
});
