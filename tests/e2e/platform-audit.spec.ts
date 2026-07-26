import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for platform audit E2E tests.`);
  return value;
}

const password = requiredEnv('SEED_DEFAULT_PASSWORD');
const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com';
const mentorEmail = 'mentor.aisha.eze.0@dangote.com';
const menteeEmail = 'mentee.segun.diallo.0@dangote.com';
const evidenceDir = path.join(
  process.cwd(),
  'full-platform-evidence',
  'browser',
);

const publicRoutes = [
  '/',
  '/about',
  '/faq',
  '/confidentiality',
  '/contact',
  '/login',
  '/signup',
  '/programme',
  '/mentor-guide',
  '/mentee-guide',
];
const adminRoutes = [
  '/admin',
  '/admin/certificates',
  '/admin/cohorts',
  '/admin/forms',
  '/admin/goals',
  '/admin/imports',
  '/admin/insights',
  '/admin/invites',
  '/admin/matching',
  '/admin/meetings',
  '/admin/mentees',
  '/admin/mentors',
  '/admin/programmes',
  '/admin/sessions',
  '/admin/settings',
  '/admin/support',
  '/admin/training',
];
const mentorRoutes = [
  '/dashboard/mentor',
  '/profile',
  '/pair',
  '/goals',
  '/sessions',
  '/messages',
  '/meetings',
  '/calendar',
  '/journal',
  '/agreements',
  '/mid-term-review',
  '/final-review',
  '/notifications',
  '/support',
  '/help',
  '/certificate',
];
const menteeRoutes = mentorRoutes.map((route) =>
  route === '/dashboard/mentor' ? '/dashboard/mentee' : route,
);

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^(password|mot de passe)$/i).fill(password);
  await page.getByRole('button', { name: /sign in|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 45_000,
  });
}

async function assertHealthyPage(page: Page, route: string) {
  console.log(`[platform-audit] checking ${route}`);
  const response = await page.goto(route, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response, `${route} should return a document response`).not.toBeNull();
  expect(
    response!.status(),
    `${route} should not return an HTTP error`,
  ).toBeLessThan(400);
  await expect(page.locator('body')).not.toContainText(
    "This page couldn't load",
  );
  await expect(page.locator('body')).not.toContainText('Application error');
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (overflow > 1) {
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className:
              typeof element.className === 'string' ? element.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.right > document.documentElement.clientWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 8),
    );
    console.log(
      `[platform-audit] overflow ${route}: ${JSON.stringify(offenders)}`,
    );
  }
  expect(
    overflow,
    `${route} should not overflow the viewport`,
  ).toBeLessThanOrEqual(1);
}

test.describe.serial('full platform route audit', () => {
  test.beforeAll(() => fs.mkdirSync(evidenceDir, { recursive: true }));

  test('all declared public routes render successfully', async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of publicRoutes) await assertHealthyPage(page, route);
    for (const [route, filename] of [
      ['/programme', 'public-programme-desktop.png'],
      ['/mentor-guide', 'public-mentor-guide-desktop.png'],
      ['/mentee-guide', 'public-mentee-guide-desktop.png'],
    ] as const) {
      await page.goto(route);
      await page.waitForTimeout(1_000);
      await page.screenshot({
        path: path.join(evidenceDir, filename),
        fullPage: true,
      });
    }
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' },
    ]);
    for (const [route, heading] of [
      ['/programme', 'Un programme.'],
      ['/mentor-guide', "Transmettre l'expérience."],
      ['/mentee-guide', "Porter l'objectif."],
    ] as const) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/');
    await page.screenshot({
      path: path.join(evidenceDir, 'public-home-desktop.png'),
      fullPage: true,
    });
  });

  test('super admin can render every static admin workspace', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await signIn(page, adminEmail);
    for (const route of adminRoutes) await assertHealthyPage(page, route);
    await page.goto('/admin');
    await page.screenshot({
      path: path.join(evidenceDir, 'admin-dashboard-desktop.png'),
      fullPage: true,
    });
  });

  test('remediated admin surfaces render in French', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, adminEmail);
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' },
    ]);

    for (const [route, heading] of [
      ['/admin/matching', 'Moteur de jumelage'],
      ['/admin/imports', 'Importer des données'],
      ['/admin/settings', 'Paramètres'],
    ] as const) {
      await assertHealthyPage(page, route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('mentor can render the complete participant navigation set', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await signIn(page, mentorEmail);
    for (const route of mentorRoutes) await assertHealthyPage(page, route);
    await page.goto('/messages');
    await page.screenshot({
      path: path.join(evidenceDir, 'mentor-messages-desktop.png'),
      fullPage: true,
    });
  });

  test('mentee can render participant routes in French and is denied admin', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await signIn(page, menteeEmail);
    await page
      .context()
      .addCookies([
        { name: 'NEXT_LOCALE', value: 'fr', domain: 'localhost', path: '/' },
      ]);
    for (const route of menteeRoutes) await assertHealthyPage(page, route);
    await page.goto('/admin');
    await page.waitForURL((url) => url.pathname === '/dashboard/mentee');
    await page.goto('/messages');
    await expect(page.getByText('Axes du mentorat')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await page.screenshot({
      path: path.join(evidenceDir, 'mentee-messages-fr-desktop.png'),
      fullPage: true,
    });
  });

  test('mobile public and authenticated shells remain contained', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertHealthyPage(page, '/');
    await page.screenshot({
      path: path.join(evidenceDir, 'public-home-mobile.png'),
      fullPage: true,
    });
    await signIn(page, menteeEmail);
    await assertHealthyPage(page, '/dashboard/mentee');
    await page.screenshot({
      path: path.join(evidenceDir, 'mentee-dashboard-mobile.png'),
      fullPage: true,
    });
  });

  test('required viewport matrix has no document-level horizontal overflow', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const widths = [320, 375, 390, 768, 1024, 1280, 1440, 1920];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await assertHealthyPage(page, '/about');
    }

    await page.setViewportSize({ width: 1280, height: 1000 });
    await signIn(page, menteeEmail);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await assertHealthyPage(page, '/dashboard/mentee');
    }
  });
});
