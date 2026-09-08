import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Sidebar navigation timings for the authenticated admin shell. Measures click →
// URL change and click → meaningful heading. Does not remove any features.
const ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
const ADMIN_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe!2026';

const ADMIN_ROUTES: { key: string; href: string; heading: RegExp }[] = [
  { key: 'matching', href: '/admin/matching', heading: /match/i },
  { key: 'insights', href: '/admin/insights', heading: /insight/i },
  { key: 'programmes', href: '/admin/programmes', heading: /programme/i },
  { key: 'cohorts', href: '/admin/cohorts', heading: /cohort/i },
  { key: 'mentors', href: '/admin/mentors', heading: /mentor/i },
  { key: 'mentees', href: '/admin/mentees', heading: /mentee/i },
  { key: 'invites', href: '/admin/invites', heading: /invite/i },
  { key: 'notifications', href: '/notifications', heading: /notification/i },
];

type TimingRow = {
  route: string;
  href: string;
  urlChangeMs: number;
  contentMs: number;
  sidebarActiveMs: number;
  failedRequests: number;
};

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin');
}

test.describe('authenticated sidebar navigation performance', () => {
  test('admin sidebar destinations respond with immediate active state and content', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const failures: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) failures.push(`${res.status()} ${res.url()}`);
    });

    await signInAsAdmin(page);

    const evidenceDir = path.join(process.cwd(), 'internal-performance-evidence', 'after');
    fs.mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceDir, 'admin-overview.png'),
      fullPage: true,
    });

    const sidebar = page.getByRole('complementary');
    const timings: TimingRow[] = [];

    for (const route of ADMIN_ROUTES) {
      failures.length = 0;
      // Prefer href matching so EN/FR label copy cannot flake the suite.
      const link = sidebar.locator(`a[href="${route.href}"]`).first();
      await expect(link).toBeVisible();

      const t0 = Date.now();
      await link.click();

      // Immediate feedback: pending (aria-busy) or already committed (aria-current).
      // Fast cache hits may skip a visible busy frame — both are valid.
      await expect
        .poll(
          async () => {
            const busy = await link.getAttribute('aria-busy');
            const current = await link.getAttribute('aria-current');
            return busy === 'true' || current === 'page';
          },
          { timeout: 2_000 },
        )
        .toBe(true);
      const sidebarActiveMs = Date.now() - t0;

      // Never two full-active designs; at most one pending destination.
      const activeVisual = await sidebar.locator('a[data-nav-state="active"]').count();
      expect(activeVisual, `active visual count for ${route.key}`).toBeLessThanOrEqual(1);
      const pendingVisual = await sidebar.locator('a[data-nav-state="pending"]').count();
      expect(pendingVisual, `pending visual count for ${route.key}`).toBeLessThanOrEqual(1);
      const busyCount = await sidebar.locator('a[aria-busy="true"]').count();
      expect(busyCount, `pending count for ${route.key}`).toBeLessThanOrEqual(1);
      const currentCount = await sidebar.locator('a[aria-current="page"]').count();
      expect(currentCount, `aria-current count for ${route.key}`).toBeLessThanOrEqual(1);

      await page.waitForURL((url) => url.pathname === route.href, { timeout: 30_000 });
      const urlChangeMs = Date.now() - t0;

      // After commit: destination is current; pending chrome cleared.
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect
        .poll(async () => (await link.getAttribute('aria-busy')) !== 'true', {
          timeout: 2_000,
        })
        .toBe(true);

      // Destination skeleton (aria-busy) or heading — never a blank main.
      await expect
        .poll(
          async () => {
            const headings = await page.getByRole('heading').count();
            const skeleton = await page.locator('main [aria-busy="true"]').count();
            return headings > 0 || skeleton > 0;
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 45_000 });
      const heading = page.getByRole('heading', { name: route.heading }).first();
      if ((await heading.count()) > 0) {
        await expect(heading).toBeVisible();
      }
      const contentMs = Date.now() - t0;

      await page.screenshot({
        path: path.join(evidenceDir, `${route.key}.png`),
        fullPage: true,
      });

      timings.push({
        route: route.key,
        href: route.href,
        urlChangeMs,
        contentMs,
        sidebarActiveMs,
        failedRequests: failures.length,
      });

      expect(failures, `5xx on ${route.href}`).toEqual([]);
      expect(sidebarActiveMs, `sidebar feedback for ${route.key}`).toBeLessThan(500);
    }

    const dash = sidebar.locator('a[href="/admin"]').first();
    await dash.click();
    await page.waitForURL('**/admin');
    await expect(page.getByRole('heading').first()).toBeVisible();

    const outDir = path.join(process.cwd(), 'internal-performance-evidence', 'navigation-timings');
    fs.mkdirSync(outDir, { recursive: true });
    const payload = {
      capturedAt: new Date().toISOString(),
      mode: process.env.CI ? 'production' : 'dev',
      project: testInfo.project.name,
      timings,
      medianContentMs: median(timings.map((t) => t.contentMs)),
      medianSidebarActiveMs: median(timings.map((t) => t.sidebarActiveMs)),
    };
    fs.writeFileSync(path.join(outDir, 'after.json'), JSON.stringify(payload, null, 2));

    // Sidebar feedback is the hard UX budget. Content time varies with cold
    // compile in `next dev`; production CI can tighten this separately.
    const contentBudgetMs = process.env.CI ? 8_000 : 20_000;
    for (const row of timings) {
      expect(row.sidebarActiveMs).toBeLessThan(500);
      expect(row.contentMs).toBeLessThan(contentBudgetMs);
    }
  });

  test('flat primary buttons remain operable on admin invites', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/invites');
    const create = page.getByRole('button').first();
    await expect(create).toBeVisible();
    const className = (await create.getAttribute('class')) ?? '';
    expect(className).not.toMatch(/shadow-glow|bg-gradient-to-b/);
  });

  test('repeat sidebar visits show content quickly without double-active state', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await signInAsAdmin(page);
    const sidebar = page.getByRole('complementary');

    async function visit(href: string) {
      const link = sidebar.locator(`a[href="${href}"]`).first();
      const t0 = Date.now();
      await link.click();
      await page.waitForURL((url) => url.pathname === href, { timeout: 30_000 });
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
      const activeCount = await sidebar.locator('a[data-nav-state="active"]').count();
      expect(activeCount).toBeLessThanOrEqual(1);
      return Date.now() - t0;
    }

    // Warm the client router cache.
    const firstInsights = await visit('/admin/insights');
    const firstProgrammes = await visit('/admin/programmes');
    // Return visits should stay interactive; production cache makes these much faster.
    const secondInsights = await visit('/admin/insights');
    const secondProgrammes = await visit('/admin/programmes');

    const outDir = path.join(process.cwd(), 'internal-performance-evidence', 'navigation-timings');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'repeat-visits.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          project: testInfo.project.name,
          firstInsights,
          firstProgrammes,
          secondInsights,
          secondProgrammes,
        },
        null,
        2,
      ),
    );

    expect(secondInsights).toBeLessThan(20_000);
    expect(secondProgrammes).toBeLessThan(20_000);
  });
});

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}
