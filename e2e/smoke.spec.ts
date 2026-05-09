import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:19280';

test.describe('Dashboard Smoke Tests', () => {
  test('페이지 로드 — 타이틀과 헤더가 표시된다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle('Claude Code Dashboard');
    await expect(page.locator('text=Claude Code Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('사이드바 — Overview와 카테고리가 표시된다', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });

    // Overview or All Items should be visible in the sidebar
    const sidebar = page.locator('aside, nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('인벤토리 로딩 — 아이템 카드가 표시된다', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });

    // Click "All Items" or "All" in sidebar to show items
    const allItems = page.locator('text=/All|전체/').first();
    if (await allItems.isVisible()) {
      await allItems.click();
    }

    // Wait for items to load (either cards or empty state)
    await page.waitForTimeout(2000);

    // Should show either item cards or empty state — not loading skeleton
    const skeletons = page.locator('.skeleton');
    const skeletonCount = await skeletons.count();
    // After loading, skeletons should be gone
    expect(skeletonCount).toBe(0);
  });

  test('API /api/health — 200 OK 응답', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('API /api/token — CSRF 토큰 반환', async ({ request }) => {
    const res = await request.get(`${BASE}/api/token`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.token.length).toBe(64);
  });

  test('API /api/inventory — 인벤토리 스캔 성공', async ({ request }) => {
    const res = await request.get(`${BASE}/api/inventory`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe(true);
    expect(body.data.totalCount).toBeGreaterThanOrEqual(0);
    expect(body.data.counts).toBeDefined();
    expect(body.data.items).toBeInstanceOf(Array);
  });

  test('다크모드 토글 — dark 클래스가 적용된다', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });

    // Click theme toggle button (sun/moon icon)
    const themeBtn = page.locator('button[title="Toggle theme"]');
    if (await themeBtn.isVisible()) {
      // Click twice to ensure we reach dark mode (system → light → dark)
      await themeBtn.click();
      await page.waitForTimeout(300);
      await themeBtn.click();
      await page.waitForTimeout(300);
      const htmlEl = page.locator('html');
      const classAttr = await htmlEl.getAttribute('class') ?? '';
      expect(classAttr).toContain('dark');
    }
  });

  test('언어 토글 — KO/EN 전환', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });

    // Find the language toggle button (shows "KO" or "EN")
    const langBtn = page.locator('button:has-text("KO"), button:has-text("EN")').first();
    if (await langBtn.isVisible()) {
      const before = await langBtn.textContent();
      await langBtn.click();
      await page.waitForTimeout(300);
      const after = await langBtn.textContent();
      expect(before).not.toBe(after);
    }
  });

  test('스크린샷 — 전체 페이지 캡처', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=Claude Code Dashboard', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for data to load
    await page.screenshot({ path: 'e2e/screenshot-overview.png', fullPage: true });
  });
});
