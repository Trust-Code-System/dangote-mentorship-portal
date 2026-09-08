// Landing-page screenshot helper. Unlike scripts/shot.mjs this waits for the
// WebGL hero to settle, can capture just the viewport (to judge the hero
// composition rather than the whole page), can force a locale, and can emulate
// reduced motion or a WebGL-less browser.
//
// Usage:
//   node scripts/shot-landing.mjs <out> [width] [height] [full|viewport] [en|fr] [normal|reduced|nowebgl]
import { chromium } from 'playwright';

const [
  ,
  ,
  out = 'shot.png',
  width = '1440',
  height = '900',
  mode = 'viewport',
  locale = 'en',
  variant = 'normal',
] = process.argv;

const base = process.env.BASE_URL ?? 'http://localhost:3001';

const browser = await chromium.launch({
  // Emulating a browser without WebGL is the only reliable way to prove the
  // fallback path actually renders.
  args: variant === 'nowebgl' ? ['--disable-gpu', '--disable-webgl', '--disable-webgl2'] : [],
});

const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference',
  deviceScaleFactor: 1,
});

// The app resolves locale from a cookie, not a path segment.
await context.addCookies([
  { name: 'NEXT_LOCALE', value: locale, url: base },
]);

const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
// Let the entrance animations finish and the scene reach a steady state.
await page.waitForTimeout(2600);

if (mode === 'full') {
  // Scroll-reveal sections only paint once their IntersectionObserver has
  // fired. A fullPage screenshot alone does not trigger that, so walk the page
  // top to bottom first, then return to the top before capturing.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.75;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await page.waitForTimeout(800);
}

if (mode.startsWith('scroll:')) {
  // Capture the viewport at an absolute scroll offset. Needed for the pinned
  // journey chapter, where "the section" is mostly pin spacer and only the
  // scroll position tells you which stage is on screen.
  const offset = Number(mode.slice('scroll:'.length));
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), offset);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
} else if (mode.startsWith('section:')) {
  // Screenshot a single section by index (0-based) among the page's <section>
  // elements, after scrolling it into view so its reveals have fired.
  const index = Number(mode.slice('section:'.length));
  const target = page.locator('main section').nth(index);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await target.screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: mode === 'full' });
}

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

await browser.close();

console.log(`saved ${out}`);
if (overflow > 0) console.log(`WARNING horizontal overflow: ${overflow}px`);
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
else console.log('no console errors');
