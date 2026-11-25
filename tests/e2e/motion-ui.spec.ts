import { expect, test } from '@playwright/test';
import { signInForAudit } from './helpers/session';

test('the front door is sign-in without a public-page detour', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('a[href="/welcome"]')).toHaveCount(0);
});

test('a mouse-closed select has no lingering ring and remains keyboard operable', async ({
  page,
}) => {
  await signInForAudit(
    page,
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com',
    process.env.SEED_DEFAULT_PASSWORD!,
  );
  await page.goto('/admin/invites');
  const select = page.getByRole('combobox').last();
  await select.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option').first().click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  expect(await select.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(select).toBeFocused();
  expect(await select.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe('2px');
});

test('closed notification panels are inert with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInForAudit(
    page,
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com',
    process.env.SEED_DEFAULT_PASSWORD!,
  );
  const trigger = page.getByRole('button', { name: 'Notifications', exact: true });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const panel = page.locator('.soft-panel').filter({ hasText: 'See all' });
  await expect(panel).toHaveAttribute('inert', '');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  expect(await panel.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
