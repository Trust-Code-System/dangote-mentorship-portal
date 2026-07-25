import { test, expect, type Page } from '@playwright/test';

/**
 * Happy-path E2E for the public landing page.
 *
 * Deliberately covers the things that a visual review cannot: that the page is
 * still usable with a keyboard, that the language control really swaps both
 * locales without losing the visitor's place, that every CTA points at a route
 * that exists, and that nothing overflows at 320px.
 */

/** Anything the app legitimately logs that must not fail a test. */
function isExpectedNoise(text: string): boolean {
  return (
    // React's dev-mode eval probe — blocked by our CSP by design, production-only concern.
    text.includes('eval() is not supported') ||
    // Vercel Analytics script is not reachable off-Vercel and is blocked by the CSP locally.
    text.includes('va.vercel-scripts.com') ||
    text.includes('[Vercel Web Analytics]')
  );
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedNoise(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    if (!isExpectedNoise(String(error))) errors.push(String(error));
  });
  return errors;
}

test.describe('landing page', () => {
  test('renders one h1, the hero copy and both CTAs, with no console errors', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/');

    const headings = page.locator('main h1');
    await expect(headings).toHaveCount(1);
    // The headline is split per word for the reveal, with the real sentence in
    // an sr-only copy — so assert on the accessible text, not the visual spans.
    await expect(headings.first()).toContainText('Experience becomes direction.');
    await expect(headings.first()).toContainText('Ambition becomes leadership.');

    await expect(page.getByRole('link', { name: 'Enter the portal' })).toHaveAttribute(
      'href',
      '/login',
    );
    await expect(page.getByRole('link', { name: 'Explore the journey' })).toHaveAttribute(
      'href',
      '#journey',
    );

    expect(errors).toEqual([]);
  });

  test('every navigation and CTA destination resolves', async ({ page }) => {
    await page.goto('/');

    // Real routes only — a link to a page that does not exist is the single
    // most embarrassing bug a marketing page can ship.
    for (const path of ['/login', '/signup', '/about', '/faq']) {
      const response = await page.request.get(path);
      expect(response.status(), `${path} should not 404`).toBeLessThan(400);
    }
  });

  test('anchor links move the visitor to the matching section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // The journey chapter calls ScrollTrigger.refresh() shortly after mount,
    // which can cancel a smooth scroll that is already in flight. Let the page
    // settle before navigating so the test measures the behaviour rather than
    // the race.
    await page.waitForTimeout(1200);

    await page.getByRole('link', { name: 'Matching', exact: true }).click();
    await expect(page).toHaveURL(/#matching$/);

    // Smooth scrolling means the final position arrives asynchronously. Poll
    // the section's offset instead of asserting once: it should come to rest
    // just below the floating nav (scroll-margin-top: 6.5rem).
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.getElementById('matching')?.getBoundingClientRect().top ?? Infinity,
          ),
        { timeout: 10_000 },
      )
      .toBeLessThan(200);

    await expect(page.locator('#matching')).toBeInViewport();
  });

  test('the skip link is the first focusable element and targets main', async ({ page }) => {
    await page.goto('/');

    // Assert the document's focus order directly. Relying on an initial Tab is
    // flaky in headless browsers because the browser viewport does not always
    // begin with document focus.
    const firstFocusable = page
      .locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      .first();
    await expect(firstFocusable).toHaveAttribute('href', '#landing-main');
    await firstFocusable.focus();
    await expect(firstFocusable).toBeVisible();
  });

  test('the matching demo is operable from the keyboard', async ({ page }) => {
    await page.goto('/');

    const firstTab = page.getByRole('tab', { name: /Competency match/ });
    await firstTab.scrollIntoViewIfNeeded();
    await firstTab.focus();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');

    // Roving tabindex: arrow keys move selection between criteria.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Career-goal alignment/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('switching to French translates the page and keeps the visitor in place', async ({
    page,
  }) => {
    await page.goto('/');

    // Move down the page first: the language switch is a cookie write inside a
    // transition, not a navigation, so scroll position must survive it.
    await page.locator('#matching').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await page.getByRole('group', { name: /language/i }).first().getByText('FR').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('main h1')).toContainText("L'expérience devient une direction.");

    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(200);
  });

  test('has no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('keeps all nine journey stages and full content under reduced motion', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');

    // No pinning, no scroll choreography — every stage is present and readable.
    const stages = page.locator('#journey li');
    await expect(stages).toHaveCount(9);
    await expect(stages.first()).toContainText('Profile');
    await expect(stages.last()).toContainText('Certificate');

    await context.close();
  });
});
