// Screenshot helper for the public Knowledge Library pages (/about, /faq,
// /confidentiality, /contact) and the auth pages the footer links to.
//
// Unlike scripts/shot-landing.mjs there is no WebGL scene to wait for, so this
// one instead walks the page to fire every scroll-reveal IntersectionObserver
// before capturing, forces a locale via the cookie the app actually reads, and
// reports horizontal overflow plus console errors for the viewport it ran at.
//
// Usage:
//   node scripts/shot-public.mjs <path> <out> [width] [height] [full|viewport] [en|fr] [normal|reduced]
import { chromium } from 'playwright';

const [
  ,
  ,
  path = '/about',
  out = 'shot.png',
  width = '1440',
  height = '900',
  mode = 'full',
  locale = 'en',
  variant = 'normal',
] = process.argv;

const base = process.env.BASE_URL ?? 'http://localhost:3001';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference',
  deviceScaleFactor: 1,
});

// The app resolves locale from a cookie, not a path segment.
await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: base }]);

const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  // The URL matters as much as the text: a "Failed to load resource: 404"
  // message carries the offending URL in its location, not its text.
  const text = `${message.text()} ${message.location()?.url ?? ''}`;
  // Known, expected local-only noise, none of it caused by page code:
  //  - the CSP blocks React's dev-mode eval probe (dev only, by design);
  //  - Vercel Analytics has no script to serve when not deployed to Vercel,
  //    which off-Vercel is a 404 and a MIME-type refusal for the same file.
  if (
    text.includes('eval() is not supported') ||
    text.includes('va.vercel-scripts.com') ||
    text.includes('_vercel/insights') ||
    text.includes('[Vercel Web Analytics]')
  ) {
    return;
  }
  errors.push(text);
});
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(900);

if (mode === 'full') {
  // Scroll-reveal blocks only paint once their observer has fired. A fullPage
  // screenshot alone does not trigger that, so walk top to bottom first.
  // `behavior: 'instant'` matters: the public pages set `scroll-behavior:
  // smooth`, so a plain scrollTo only *starts* an animation. Chaining smooth
  // scrolls 130ms apart never reaches the bottom of a long page, and the last
  // sections stay unrevealed in the capture.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 130));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
  await page.waitForTimeout(700);
}

if (mode.startsWith('selector:')) {
  const target = page.locator(mode.slice('selector:'.length)).first();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await target.screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: mode === 'full' });
}

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
const h1s = await page.locator('main h1').count();

await browser.close();

console.log(`saved ${out} (${path} · ${locale} · ${width}x${height})`);
console.log(`h1 count: ${h1s}`);
if (overflow > 0) console.log(`WARNING horizontal overflow: ${overflow}px`);
else console.log('no horizontal overflow');
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
else console.log('no console errors');
