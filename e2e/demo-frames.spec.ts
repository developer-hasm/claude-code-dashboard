// Captures a timed sequence of PNG frames for the README demo GIF.
// Frames go to docs/.demo-frames/ (gitignored). The GIF is then assembled
// by `node scripts/build-demo-gif.mjs`.

import { test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const FRAMES_DIR = path.join(__dirname, '..', 'docs', '.demo-frames');
fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

let frameIdx = 0;
function frameName() {
  return path.join(FRAMES_DIR, `${String(frameIdx++).padStart(3, '0')}.png`);
}

test.describe('Demo GIF frames', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('capture sequence', async ({ page }) => {
    test.setTimeout(120_000);

    // ── Setup ──
    await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
    await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
    await page.waitForTimeout(2500);

    // Force English
    const langBtn = page.locator('button:has-text("EN"), button:has-text("KO")').first();
    if ((await langBtn.textContent())?.trim() === 'EN') {
      await langBtn.click();
      await page.waitForTimeout(800);
    }

    // ── Frames 0-3: Hold on Overview (top of page) ──
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < 4; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(150);
    }

    // ── Frames 4-7: Scroll down to Cost Breakdown card ──
    const costCard = page.locator('text=/^Cost Breakdown$/').first();
    await costCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    for (let i = 0; i < 4; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(150);
    }

    // ── Frames 8-10: Click "By Agent" tab ──
    await page.locator('button:has-text("By Agent")').first().click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(200);
    }

    // ── Frames 11-13: Click "By Skill" tab ──
    await page.locator('button:has-text("By Skill")').first().click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(200);
    }

    // ── Frames 14-16: Navigate to Session category ──
    await page.locator('text=/^Session$/').first().click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < 3; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(200);
    }

    // ── Frames 17-22: Type "marketplace" character by character into FTS box ──
    const searchInputs = page.locator('input[type="search"]');
    const fts = (await searchInputs.count()) >= 2 ? searchInputs.nth(1) : searchInputs.first();
    await fts.click();
    const word = 'marketplace';
    for (const ch of word) {
      await fts.press(ch.length === 1 ? ch : 'a');
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(900); // wait for debounce + results

    // ── Frames 23-27: Hold on results ──
    for (let i = 0; i < 5; i++) {
      await page.screenshot({ path: frameName() });
      await page.waitForTimeout(200);
    }

    console.log(`Captured ${frameIdx} frames to ${FRAMES_DIR}`);
  });
});
