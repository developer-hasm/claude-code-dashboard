import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('새 기능 — Cost Breakdown + Session Search 스크린샷', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(3000);

  // ── Overview screenshot — should include CostBreakdown card ──
  await page.screenshot({ path: 'e2e/feature-overview.png', fullPage: true });

  // Verify CostBreakdown title is rendered
  await expect(page.locator('text=/Cost Breakdown|비용 분석/').first()).toBeVisible();

  // Click "By Project" tab (default), then "By Agent"
  const agentTab = page.locator('button', { hasText: /By Agent|에이전트별/ }).first();
  if (await agentTab.isVisible()) {
    await agentTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/feature-cost-by-agent.png', fullPage: true });
  }

  // ── Session page — search ──
  await page.locator('text=/Session|세션/').first().click();
  await page.waitForTimeout(1500);

  // Verify the FTS search bar exists
  await expect(page.locator('text=/Search inside conversations|대화 내용 검색/').first()).toBeVisible();

  // Type a query
  const searchInput = page.locator('input[type="search"][placeholder*="marketplace" i], input[type="search"][placeholder*="플러그인" i]').first();
  await searchInput.fill('marketplace');
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'e2e/feature-session-search.png', fullPage: true });

  // Should show at least one hit for "marketplace"
  const hits = page.locator('mark', { hasText: /marketplace/i });
  const hitCount = await hits.count();
  console.log(`FTS hits with <mark> for "marketplace": ${hitCount}`);
  expect(hitCount).toBeGreaterThan(0);
});
