import { test, expect, type Page } from '@playwright/test';

/**
 * Authentication experience — behaviour that a screenshot cannot prove.
 *
 * These deliberately do NOT test authentication itself (that is covered by
 * m0-login.spec.ts and unchanged here). They cover the UX contract of the
 * redesign: labels, keyboard operability, state preservation, and the fact that
 * the page never leaks whether an account exists.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const expected = (text: string) =>
    text.includes('eval() is not supported') ||
    text.includes('va.vercel-scripts.com') ||
    text.includes('[Vercel Web Analytics]');

  page.on('console', (m) => {
    if (m.type() === 'error' && !expected(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (!expected(String(e))) errors.push(String(e));
  });
  return errors;
}

test.describe('authentication experience', () => {
  test('login renders one h1, labelled fields and working links, with no console errors', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/login');

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Welcome back');

    // Labels are real and associated — not placeholders standing in for them.
    await expect(page.getByLabel('Corporate email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/signup',
    );

    expect(errors).toEqual([]);
  });

  test('every footer destination is reachable while signed out', async ({ page }) => {
    await page.goto('/login');

    // Support must not point at an auth-gated route: the whole point is that
    // you can reach it when you cannot sign in. It is a mailto: for that reason.
    const support = page.getByRole('link', { name: 'Support' });
    await expect(support).toHaveAttribute('href', /^mailto:/);

    for (const path of ['/faq', '/', '/signup', '/forgot-password']) {
      const response = await page.request.get(path);
      expect(response.status(), `${path} should be reachable`).toBeLessThan(400);
    }
  });

  test('the password visibility toggle is keyboard operable and labelled', async ({ page }) => {
    await page.goto('/login');

    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');

    const toggle = page.getByRole('button', { name: 'Show password' });
    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toBeVisible();
  });

  test('the language switcher translates the page without clearing a typed email', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Corporate email').fill('someone@blakmoh.com');
    await page.getByRole('button', { name: 'Français' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('h1')).toHaveText('Bon retour parmi nous');

    // Switching language is a cookie write in a transition, not a navigation —
    // a half-completed form must survive it.
    await expect(page.getByLabel('E-mail professionnel')).toHaveValue('someone@blakmoh.com');
  });

  test('a failed sign-in keeps the email, clears the password, and stays generic', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Corporate email').fill('qa-nonexistent@blakmoh.com');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Invalid email or password' });
    await expect(alert).toBeVisible({ timeout: 30_000 });

    // Never confirm or deny that the address exists.
    await expect(alert).not.toContainText(/no account|not found|does not exist|unknown user/i);

    // The email survives so it need not be retyped; the password does not.
    await expect(page.getByLabel('Corporate email')).toHaveValue('qa-nonexistent@blakmoh.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  });

  test('password reset stays enumeration-safe for an unknown address', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel('Corporate email').fill('qa-nonexistent@blakmoh.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    const status = page.getByRole('status');
    await expect(status).toBeVisible({ timeout: 30_000 });
    // The confirmation is conditional by design — "If an account exists…".
    await expect(status).toContainText(/if an account exists/i);
  });

  test('an unusable reset link explains itself and offers a way forward', async ({ page }) => {
    await page.goto('/reset-password/not-a-real-token');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  test('an unusable invitation explains itself', async ({ page }) => {
    await page.goto('/invite/not-a-real-token');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request access' })).toBeVisible();
  });

  test('no auth page overflows horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    for (const path of ['/login', '/forgot-password', '/signup', '/invite/not-a-real-token']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows`).toBeLessThanOrEqual(0);
    }
  });
});
