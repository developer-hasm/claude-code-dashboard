import { test } from '@playwright/test';

test.setTimeout(60000);

test('수동 확인 — 대시보드 전체 스크린샷', async ({ page }) => {
  await page.goto('http://127.0.0.1:19280', { waitUntil: 'load' });
  await page.waitForSelector('text=/Claude Code Dashboard/', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'e2e/manual-overview.png', fullPage: true });

  // Sidebar text content
  const sidebarText = await page.locator('aside, nav').first().innerText();
  console.log('=== SIDEBAR ===');
  console.log(sidebarText);

  // Click MCP Server
  const mcpBtn = page.locator('text=/MCP Server|MCP 서버/').first();
  if (await mcpBtn.isVisible()) {
    await mcpBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/manual-mcp.png', fullPage: true });
    const main = await page.locator('main').innerText().catch(() => '');
    console.log('=== MCP PAGE ===');
    console.log(main.slice(0, 500));
  }
});
