import type { Page, BrowserContext } from '@playwright/test';

const sessions = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();

// Route/layout audits reuse an actual signed-in session within this worker.
// Repeated logins otherwise exhaust the real five-attempt/minute throttle.
// m0-login and auth-ui still exercise credentials independently; no auth or
// rate-limit bypass is enabled in the application or its CI environment.
export async function signInForAudit(page: Page, email: string, password: string) {
  const cookies = sessions.get(email);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto('/dashboard');
  } else {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^(password|mot de passe)$/i).fill(password);
    await page.getByRole('button', { name: /sign in|se connecter/i }).click();
  }
  await page.waitForURL((url) => !/^\/(login|dashboard)$/.test(url.pathname), { timeout: 45_000 });
  if (!cookies) {
    sessions.set(
      email,
      (await page.context().cookies()).filter((cookie) =>
        cookie.name.includes('authjs.session-token'),
      ),
    );
  }
}
