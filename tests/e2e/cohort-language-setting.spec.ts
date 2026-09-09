import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
const password = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(adminEmail);
  await page.getByLabel(/^(password|mot de passe)$/i).fill(password);
  await page.getByRole('button', { name: /sign in|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 });
}

async function openActiveCohort(page: Page) {
  await page.goto('/admin/cohorts');
  const activeRow = page.getByRole('row').filter({ hasText: 'Cohort 2026 (Jan–Sep)' });
  await activeRow.getByRole('link', { name: /edit|modifier/i }).click();
  await expect(
    page.getByRole('heading', { name: /edit cohort|modifier la cohorte/i }),
  ).toBeVisible();
}

for (const viewport of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
] as const) {
  test(`admin can turn cohort French off and on at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await openActiveCohort(page);

    const frenchSwitch = page.getByRole('switch', { name: /french|français/i });
    const switchTarget = page.locator('label[for="cohort-french-enabled"]');

    await expect(frenchSwitch).toBeChecked();
    await expect(switchTarget).toBeVisible();
    const box = await switchTarget.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await switchTarget.click();
    await expect(frenchSwitch).not.toBeChecked();
    await expect
      .poll(() =>
        page
          .locator('form')
          .first()
          .evaluate((form) =>
            new FormData(form as HTMLFormElement).getAll('languages').map(String),
          ),
      )
      .toEqual(['EN']);

    await switchTarget.click();
    await expect(frenchSwitch).toBeChecked();
    await expect
      .poll(() =>
        page
          .locator('form')
          .first()
          .evaluate((form) =>
            new FormData(form as HTMLFormElement).getAll('languages').map(String),
          ),
      )
      .toEqual(['EN', 'FR']);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
