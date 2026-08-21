import { test, expect } from '@playwright/test';

/**
 * Guards for the nonce-based CSP.
 *
 * These exist because of a real production outage. The policy first shipped
 * with `'strict-dynamic'`, which makes browsers ignore `'self'` so that *every*
 * script element must carry the nonce — and Turbopack emits one async chunk
 * without one, so it was blocked on every page load. Nothing caught it: the
 * build script pinned `--webpack` while Vercel built with Turbopack, and the
 * verification at the time checked only *inline* scripts, never `<script src>`.
 *
 * Two properties are asserted, and the split matters:
 *
 *  - **Inline scripts must always be nonced.** `'unsafe-inline'` is gone, so an
 *    un-nonced inline script is a blocked script and a broken page.
 *  - **Full nonce coverage is required only if `'strict-dynamic'` is present.**
 *    Today it is deliberately absent, so `'self'` covers same-origin `<script
 *    src>` and Turbopack's un-nonced chunk is harmless. If anyone re-adds
 *    `'strict-dynamic'` without first fixing that chunk, this fails loudly
 *    instead of shipping the outage again.
 */
const PAGES = ['/', '/login', '/about'];

for (const path of PAGES) {
  test(`CSP nonce covers the scripts that need it on ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    const csp: string | undefined = response!.headers()['content-security-policy'];
    expect(csp, 'no CSP header served').toBeTruthy();
    // Narrow for the rest of the test; the assertion above is the real check.
    if (!csp) return;
    expect(csp, "script-src must not fall back to 'unsafe-inline'").not.toMatch(
      /script-src[^;]*'unsafe-inline'/,
    );

    const headerNonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(headerNonce, `CSP carries no nonce: ${csp}`).toBeTruthy();

    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll('script')].map((s) => ({
        src: s.getAttribute('src'),
        nonce: s.nonce || s.getAttribute('nonce'),
        inline: !s.getAttribute('src'),
      })),
    );
    expect(scripts.length, 'no script tags found — the page did not render').toBeGreaterThan(0);

    // Inline scripts: always required, and the nonce must be the served one.
    const badInline = scripts.filter((s) => s.inline && s.nonce !== headerNonce);
    expect(
      badInline,
      `inline scripts missing the served nonce (${headerNonce}) would be blocked`,
    ).toEqual([]);

    // Everything else: only required under 'strict-dynamic', which turns off 'self'.
    if (/script-src[^;]*'strict-dynamic'/.test(csp)) {
      const unnonced = scripts.filter((s) => s.nonce !== headerNonce);
      expect(
        unnonced,
        `'strict-dynamic' is in the policy, so 'self' is ignored and these are blocked:\n` +
          unnonced.map((s) => `  ${s.inline ? '(inline)' : s.src}`).join('\n') +
          `\nEither nonce them or drop 'strict-dynamic' — see src/lib/security/csp.ts.`,
      ).toEqual([]);
    }
  });
}

test('no CSP violations fire while the landing page loads and hydrates', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} <- ${e.blockedURI}`,
      );
    });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let hydration and deferred chunks settle

  const violations = await page.evaluate(
    () => (window as unknown as { __csp: string[] }).__csp ?? [],
  );
  expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([]);
});
