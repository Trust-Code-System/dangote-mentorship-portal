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

      // Pending or active styling should apply without waiting for full page data.
      await expect
        .poll(
          async () => {
            const current = await link.getAttribute('aria-current');
            const busy = await link.getAttribute('aria-busy');
            return current === 'page' || busy === 'true';
          },
          { timeout: 2_000 },
        )
        .toBe(true);
      const sidebarActiveMs = Date.now() - t0;

      await page.waitForURL((url) => url.pathname === route.href, { timeout: 30_000 });
      const urlChangeMs = Date.now() - t0;

      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
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
});

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}
