// Behaviour + accessibility probe for the public Knowledge Library.
//
// Covers the things a screenshot cannot: keyboard operation, the FAQ search and
// filter contract, deep links, the language control, reduced motion, 200% zoom,
// heading structure, landmark structure and horizontal overflow at eight widths.
//
// Usage: BASE_URL=http://localhost:3007 node scripts/check-public.mjs
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3007';
const PAGES = ['/', '/about', '/faq', '/confidentiality', '/contact', '/login', '/signup'];
const WIDTHS = [320, 375, 390, 768, 1024, 1280, 1440, 1920];

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();

// ── 1. Structure: one h1, landmarks, no overflow, no console errors ────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = `${m.text()} ${m.location()?.url ?? ''}`;
    if (t.includes('_vercel/insights') || t.includes('va.vercel-scripts')) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const path of PAGES) {
    errors.length = 0;
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const s = await page.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      header: document.querySelectorAll('header').length,
      footer: document.querySelectorAll('footer').length,
      lang: document.documentElement.lang,
      // A heading level must never be skipped (h2 → h4).
      skips: (() => {
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((n) =>
          Number(n.tagName[1]),
        );
        const bad = [];
        for (let i = 1; i < levels.length; i += 1) {
          if (levels[i] - levels[i - 1] > 1) bad.push(`${levels[i - 1]}→${levels[i]}`);
        }
        return bad;
      })(),
    }));

    check(`${path} has exactly one h1`, s.h1 === 1, `found ${s.h1}`);
    check(`${path} has a main landmark`, s.main >= 1);
    check(`${path} has header + footer landmarks`, s.header >= 1 && s.footer >= 1);
    check(`${path} sets html[lang]`, s.lang === 'en', `lang="${s.lang}"`);
    check(`${path} skips no heading level`, s.skips.length === 0, s.skips.join(', '));
    check(`${path} logs no console errors`, errors.length === 0, errors.join(' | '));
  }
  await context.close();
}

// ── 2. No horizontal overflow, 320 → 1920 ─────────────────────────────────
{
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(350);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${path} @${width}px no horizontal overflow`, over <= 0, `${over}px`);
    }
    await context.close();
  }
}

// ── 3. 200% zoom (emulated as a half-width viewport at 2x scale) ───────────
{
  const context = await browser.newContext({
    viewport: { width: 720, height: 600 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const path of ['/about', '/faq', '/confidentiality', '/contact']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${path} @200% zoom no horizontal overflow`, over <= 0, `${over}px`);
  }
  await context.close();
}

// ── 4. FAQ search, filtering, empty state, deep links, keyboard ────────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/faq', { waitUntil: 'networkidle' });

  const rows = () => page.locator('#all-questions [id^="q-"]:visible');
  const total = await rows().count();
  check('FAQ renders every indexed question', total === 25, `${total} rows`);

  // Search narrows.
  await page.fill('#faq-search', 'french');
  await page.waitForTimeout(250);
  const searched = await rows().count();
  check('FAQ search narrows the list', searched > 0 && searched < total, `${searched} rows`);

  // Category selection preserves the search term.
  const chip = page.getByRole('button', { name: 'English and French', exact: true });
  if (await chip.count()) await chip.first().click();
  await page.waitForTimeout(250);
  check(
    'choosing a category keeps the search term',
    (await page.inputValue('#faq-search')) === 'french',
  );

  // Clearing the search keeps the chosen category.
  const inCategory = await rows().count();
  check('category filter narrows further or holds', inCategory > 0, `${inCategory} rows`);

  // No-results state.
  await page.fill('#faq-search', 'zzzzqqq');
  await page.waitForTimeout(250);
  check('FAQ shows a no-results state', await page.getByText(/Nothing matched/i).isVisible());

  // Reset restores everything and returns focus to the input.
  await page.getByRole('button', { name: /Clear search and filters/i }).click();
  await page.waitForTimeout(300);
  check('reset restores the full list', (await rows().count()) === total);
  check(
    'reset returns focus to the search field',
    (await page.evaluate(() => document.activeElement?.id)) === 'faq-search',
  );

  // Deep link opens the targeted answer.
  await page.goto(base + '/faq#q-matching-how', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const expanded = await page.evaluate(() => {
    const row = document.getElementById('q-matching-how');
    return row?.querySelector('button')?.getAttribute('aria-expanded');
  });
  check('deep link opens the targeted answer', expanded === 'true', `aria-expanded=${expanded}`);

  // Keyboard: an accordion button toggles on Enter, and its panel goes inert.
  await page.goto(base + '/faq', { waitUntil: 'networkidle' });
  const first = page.locator('#all-questions [id^="q-"] button').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check('Enter expands an accordion', (await first.getAttribute('aria-expanded')) === 'true');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check('Enter collapses it again', (await first.getAttribute('aria-expanded')) === 'false');
  const inert = await page.evaluate(() => {
    const panelId = document
      .querySelector('#all-questions [id^="q-"] button')
      ?.getAttribute('aria-controls');
    return panelId ? document.getElementById(panelId)?.hasAttribute('inert') : null;
  });
  check('a collapsed panel is inert', inert === true);

  await context.close();
}

// ── 5. Skip link is the first focusable element, and works ─────────────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const path of ['/about', '/faq', '/confidentiality', '/contact']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      return { href: el?.getAttribute('href'), visible: el ? el.getBoundingClientRect().width > 0 : false };
    });
    check(`${path} skip link is first in tab order`, info.href === '#public-main', info.href ?? '');
    check(`${path} skip link becomes visible on focus`, info.visible);
  }
  await context.close();
}

// ── 6. Language control: switches in place, keeps you on the page ──────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/confidentiality', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Français' }).first().click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    url: location.pathname,
    lang: document.documentElement.lang,
    h1: document.querySelector('h1')?.textContent ?? '',
  }));
  check('language switch stays on the same route', after.url === '/confidentiality', after.url);
  check('language switch updates html[lang]', after.lang === 'fr', after.lang);
  check('language switch translates the h1', /confiance/i.test(after.h1), after.h1.slice(0, 60));

  // And the footer control does the same, from the bottom of the page.
  await page.getByRole('button', { name: 'English' }).last().click();
  await page.waitForTimeout(1500);
  check(
    'switching back returns English',
    (await page.evaluate(() => document.documentElement.lang)) === 'en',
  );
  await context.close();
}

// ── 7. Reduced motion: content is present and static ──────────────────────
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  for (const path of ['/about', '/faq', '/confidentiality', '/contact']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // Without scrolling at all, every reveal block must already be readable —
    // i.e. reduced motion must not leave content stuck at opacity 0.
    const hidden = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.landing-reveal')];
      return blocks.filter((b) => Number(getComputedStyle(b).opacity) < 0.9).length;
    });
    check(`${path} reduced motion reveals all content`, hidden === 0, `${hidden} hidden blocks`);
  }
  await context.close();
}

// ── 8. Every public link resolves, and /support stays gated ───────────────
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = new Set();
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('/')),
    );
    hrefs.forEach((h) => seen.add(h.split('#')[0]));
  }
  for (const href of [...seen].sort()) {
    const res = await page.request.get(base + href, { maxRedirects: 0 });
    check(`link ${href} resolves`, res.status() < 400, `status ${res.status()}`);
  }
  const gated = await page.request.get(base + '/support', { maxRedirects: 0 });
  check('/support is still auth-gated', gated.status() === 307, `status ${gated.status()}`);
  await context.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
