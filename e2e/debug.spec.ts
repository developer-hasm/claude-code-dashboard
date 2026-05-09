import { test } from '@playwright/test';

test('디버그 — 페이지 로드 + 콘솔 로그 + 스크린샷', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[PAGE_ERROR] ${err.message}`));

  await page.goto('http://127.0.0.1:19280', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'e2e/debug-screenshot.png', fullPage: true });

  // Dump page content
  const html = await page.content();
  const bodyText = await page.locator('body').innerText().catch(() => '(empty)');

  console.log('=== CONSOLE LOGS ===');
  for (const log of logs) console.log(log);
  console.log('=== BODY TEXT ===');
  console.log(bodyText.slice(0, 2000));
  console.log('=== HTML LENGTH ===');
  console.log(html.length);
});
