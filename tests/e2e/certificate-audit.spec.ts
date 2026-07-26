import { expect, test, type Page } from '@playwright/test';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for certificate E2E tests.`);
  }
  return value;
}

const password = requiredEnv('SEED_DEFAULT_PASSWORD');
const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
const matchedMenteeEmail = 'mentee.segun.diallo.0@dangote.com';
const unrelatedMenteeEmail = 'mentee.ifeoma.sow.1@dangote.com';

test.setTimeout(180_000);

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test.describe.serial('certificate experience audit', () => {
  let matchId = '';
  let role = '';

  test('admin previews a real participant and downloads a marked ineligible PDF', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().includes('va.vercel-scripts.com') &&
        !message.text().includes('eval() is not supported') &&
        !message.text().includes('Failed to load resource')
      ) {
        errors.push(message.text());
      }
    });

    await signIn(page, adminEmail);
    await page.goto('/admin/certificates');
    await expect(
      page.getByRole('heading', { name: 'Certificate management' }),
    ).toBeVisible();

    const participant = page.getByLabel('Participant');
    const options = await participant.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
    const value = await options[1]!.getAttribute('value');
    expect(value).toBeTruthy();
    const parsedParticipant = value!.split(':');
    if (!parsedParticipant[0] || !parsedParticipant[1]) {
      throw new Error('Certificate participant option is malformed.');
    }
    matchId = parsedParticipant[0];
    role = parsedParticipant[1];

    await participant.selectOption(value!);
    await Promise.all([
      page.waitForURL('**/admin/certificates?participant=**'),
      page.getByRole('button', { name: 'Generate preview' }).click(),
    ]);
    await expect(page.locator('#certificate')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Incomplete · preview only')).toBeVisible();
    await page.screenshot({
      path: 'certificate-evidence/admin-certificate-desktop.png',
      fullPage: true,
    });

    const previewResponse = await page.request.get(
      `/api/certificates/${matchId}/pdf?role=${role}&lang=EN&preview=1`,
    );
    expect(previewResponse.status()).toBe(200);
    expect(previewResponse.headers()['content-type']).toBe('application/pdf');
    expect((await previewResponse.body()).subarray(0, 4).toString()).toBe(
      '%PDF',
    );

    const officialResponse = await page.request.get(
      `/api/certificates/${matchId}/pdf?role=${role}&lang=EN`,
    );
    expect(officialResponse.status()).toBe(409);
    expect(errors).toEqual([]);
  });

  test('mobile admin preview remains operable and contained', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, adminEmail);
    await page.goto(
      `/admin/certificates?participant=${encodeURIComponent(`${matchId}:${role}`)}&lang=FR`,
    );
    await expect(page.locator('#certificate')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'English' })).toBeVisible();
    const documentOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(documentOverflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: 'certificate-evidence/admin-certificate-mobile-fr.png',
      fullPage: true,
    });
  });

  test('matched participant sees only their own preview and cannot issue it early', async ({
    page,
  }) => {
    await signIn(page, matchedMenteeEmail);
    await page.goto('/certificate?lang=FR');
    await expect(page.locator('#certificate')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#certificate')).toContainText(
      'Aperçu du certificat',
    );
    await page.screenshot({
      path: 'certificate-evidence/participant-certificate-fr.png',
      fullPage: true,
    });

    const response = await page.request.get(
      `/api/certificates/${matchId}/pdf?role=mentee&lang=FR`,
    );
    expect(response.status()).toBe(409);
  });

  test('an unrelated participant cannot access a certificate by direct URL', async ({
    page,
  }) => {
    await signIn(page, unrelatedMenteeEmail);
    const response = await page.request.get(
      `/api/certificates/${matchId}/pdf?role=mentee&lang=EN&preview=1`,
    );
    expect(response.status()).toBe(404);
  });
});
