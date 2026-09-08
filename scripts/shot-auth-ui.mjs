// Auth UI evidence capture. Drives the real forms rather than screenshotting a
// static page, so the error, loading and success states are the genuine ones.
//
// (Distinct from scripts/shot-auth.mjs, which signs in to capture *authenticated*
// portal pages. This one only exercises the signed-out auth experience.)
//
// Usage: node scripts/shot-auth-ui.mjs <scenario> <out> [width] [height] [en|fr]
import { chromium } from 'playwright';

const [, , scenario = 'login', out = 'shot.png', width = '1440', height = '900', locale = 'en'] =
  process.argv;

const base = process.env.BASE_URL ?? 'http://localhost:3001';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 1,
});
await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: base }]);

const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  // React's dev-mode eval probe is blocked by this repo's CSP by design.
  if (m.type() === 'error' && !m.text().includes('eval() is not supported')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

const emailField = () => page.getByLabel(/corporate email|e-mail professionnel/i);
const passwordField = () => page.getByLabel(/^password$|^mot de passe$/i);
const submit = (name) => page.getByRole('button', { name });

switch (scenario) {
  case 'login':
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
    break;

  case 'expired':
    await page.goto(`${base}/login?expired=1`, { waitUntil: 'networkidle' });
    break;

  case 'login-error': {
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
    // A deliberately non-existent address: exercises the failure path without
    // touching a real account's rate-limit bucket.
    await emailField().fill('qa-nonexistent@blakmoh.com');
    await passwordField().fill('not-the-password');
    await submit(/sign in|se connecter/i).click();
    // Wait for our own message text, not just any `role="alert"` — Next's dev
    // overlay also uses that role and resolves instantly, which would capture
    // the still-pending form instead of the error.
    await page
      .getByText(/invalid email or password|e-mail ou mot de passe/i)
      .waitFor({ timeout: 30000 });
    break;
  }

  case 'login-loading': {
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
    await emailField().fill('qa-loading@blakmoh.com');
    await passwordField().fill('not-the-password');
    await submit(/sign in|se connecter/i).click();
    // Catch the in-flight state: spinner + "Signing in…" + aria-busy.
    await page.waitForFunction(
      () => document.querySelector('button[type=submit]')?.getAttribute('aria-busy') === 'true',
      { timeout: 10000 },
    );
    break;
  }

  case 'forgot':
    await page.goto(`${base}/forgot-password`, { waitUntil: 'networkidle' });
    break;

  case 'forgot-sent': {
    await page.goto(`${base}/forgot-password`, { waitUntil: 'networkidle' });
    await emailField().fill('qa-nonexistent@blakmoh.com');
    await submit(/send reset link|envoyer/i).click();
    await page.getByText(/if an account exists|si un compte existe/i).waitFor({ timeout: 30000 });
    break;
  }

  case 'reset-invalid':
    await page.goto(`${base}/reset-password/not-a-real-token`, { waitUntil: 'networkidle' });
    break;

  case 'invite-invalid':
    await page.goto(`${base}/invite/not-a-real-token`, { waitUntil: 'networkidle' });
    break;

  case 'request-access':
    await page.goto(`${base}/signup`, { waitUntil: 'networkidle' });
    break;

  default:
    throw new Error(`unknown scenario: ${scenario}`);
}

await page.waitForTimeout(scenario === 'login-loading' ? 60 : 900);
await page.screenshot({ path: out });

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

await browser.close();
console.log(`saved ${out}`);
if (overflow > 0) console.log(`WARNING horizontal overflow: ${overflow}px`);
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
