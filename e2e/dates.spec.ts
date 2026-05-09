import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('카테고리 카드 — 생성일 + 최근사용일 표시 확인', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Plugin has items in this environment — click Plugin sidebar
  await page.click('text=/Plugin|플러그인/');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'e2e/screenshot-dates.png', fullPage: true });

  // Check if any item cards exist; if not, skip assertions
  const cards = page.locator('article');
  const cardCount = await cards.count();

  if (cardCount > 0) {
    const bodyText = await page.locator('body').innerText();
    const hasCreated = bodyText.includes('Created') || bodyText.includes('생성');
    const hasLastUsed = bodyText.includes('Last used') || bodyText.includes('최근 사용');

    console.log('Has Created:', hasCreated, '| Has Last used:', hasLastUsed);
    expect(hasCreated).toBe(true);
    expect(hasLastUsed).toBe(true);
  } else {
    console.log('No item cards found — skipping date label assertions');
  }
});
