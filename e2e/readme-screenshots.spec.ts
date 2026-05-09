// Generates clean screenshots for README. Output goes to docs/screenshots/
// (which is NOT in .gitignore — committed to the repo for README rendering).

import { test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

// Force English locale. The toggle button shows the TARGET language —
// if label is "EN", we're on KO and need to click to switch.
async function forceEnglish(page: Page) {
  const btn = page.locator('button:has-text("EN"), button:has-text("KO")').first();
  if (!(await btn.isVisible())) return;
  const txt = (await btn.textContent())?.trim();
  if (txt === 'EN') {
    await btn.click();
    await page.waitForTimeout(800);
  }
}

async function bootstrap(page: Page) {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await forceEnglish(page);
}

test.describe('README screenshots', () => {
  test.use({ viewport: VIEWPORT });

  test('01-overview', async ({ page }) => {
    await bootstrap(page);
    await page.screenshot({
      path: path.join(OUT_DIR, '01-overview.png'),
      fullPage: true,
    });
  });

  test('02-cost-breakdown', async ({ page }) => {
    await bootstrap(page);
    const costCard = page.locator('text=/^Cost Breakdown$/').first().locator('..').locator('..');
    await costCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await costCard.screenshot({ path: path.join(OUT_DIR, '02-cost-breakdown.png') });
  });

  test('03-session-search', async ({ page }) => {
    await bootstrap(page);

    await page.getByText(/^Session$/).first().click();
    await page.waitForTimeout(2000);

    const searchInputs = page.locator('input[type="search"]');
    const count = await searchInputs.count();
    const target = count >= 2 ? searchInputs.nth(1) : searchInputs.first();
    await target.fill('marketplace');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(OUT_DIR, '03-session-search.png'),
      fullPage: true,
    });
  });

  test('04-mcp-page', async ({ page }) => {
    await bootstrap(page);

    await page.locator('text=/^MCP Server$/').first().click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(OUT_DIR, '04-mcp.png'),
      fullPage: true,
    });
  });
});
