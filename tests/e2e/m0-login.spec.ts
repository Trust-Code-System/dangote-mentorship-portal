import { test, expect } from '@playwright/test';

// M0 happy path (DoD): a user logs in with email/password and lands on a
// role-correct dashboard. Uses the seeded Super Admin account.
const ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
const ADMIN_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe!2026';

test('super admin signs in and lands on the admin dashboard', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  // Exact match so the field isn't confused with the "Show password" toggle
  // button, whose aria-label also contains "password".
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Admin role → /admin (lib/auth/roles.ts defaultDashboardPath).
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Enterprise Health Dashboard' })).toBeVisible();

  // The admin sidebar exposes the M0 management areas.
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByRole('link', { name: 'Cohorts' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Invites' })).toBeVisible();
});

test('unauthenticated visitors are redirected to login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/login**');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('readiness probe confirms the database is reachable', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ status: 'ok', db: 'up' });
});

test('public responses include the required security headers', async ({ request }) => {
  const response = await request.get('/login');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
