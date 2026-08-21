/**
 * Measure real contrast for hero text sitting over the WebGL scene.
 *
 * axe reports "background could not be determined" for text over a gradient or
 * canvas and leaves it as `incomplete` — a question, not a finding. This answers
 * it by measurement: hide the text, screenshot the exact rectangle it occupied,
 * and compute the WCAG ratio between the text colour and the actual rendered
 * pixels behind it — worst-case pixel, not the average.
 *
 * Usage: node scripts/measure-hero-contrast.mjs [url]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL_ = process.argv[2] || 'https://dangote-mentorship-portal.vercel.app/';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const srgb = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL_, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500); // let the hero entry animation finish

// Every text node in the hero, with its colour, box and effective font size.
const targets = await page.evaluate(() => {
  const hero = document.querySelector('h1');
  if (!hero) return [];
  const out = [];
  const push = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const cs = getComputedStyle(el);
    if (!el.textContent?.trim()) return;
    out.push({
      selector: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      text: el.textContent.trim().slice(0, 40),
      color: cs.color,
      fontSize: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    });
  };
  push(hero);
  hero.querySelectorAll('span').forEach(push);
  const lede = document.querySelector('h1 ~ p, h1 + * p');
  if (lede) push(lede);

  // Register show/hide helpers keyed by the same index the runner iterates, so
  // exactly one element is hidden per measurement.
  const els = [hero, ...hero.querySelectorAll('span')];
  if (lede) els.push(lede);
  window.__els = els.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4 && e.textContent?.trim();
  });
  window.__hide = (i) => { if (window.__els[i]) window.__els[i].style.visibility = 'hidden'; };
  window.__show = (i) => { if (window.__els[i]) window.__els[i].style.visibility = ''; };
  return out;
});

const raw = async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  return { data, ch: info.channels };
};

const results = [];
for (const [idx, t] of targets.entries()) {
  const { x, y, w, h } = t.rect;
  if (y < 0 || x < 0 || w <= 0 || h <= 0) continue;
  const clip = { x, y, width: w, height: Math.min(h, 400) };

  // With the text visible, then with only THIS element hidden — so the second
  // shot is exactly the backdrop behind this element and nothing else.
  const withText = await page.screenshot({ clip });
  await page.evaluate((i) => { window.__hide?.(i); }, idx);
  await page.waitForTimeout(150);
  const withoutText = await page.screenshot({ clip });
  await page.evaluate((i) => { window.__show?.(i); }, idx);
  await page.waitForTimeout(150);

  const A = await raw(withText);
  const B = await raw(withoutText);

  const m = t.color.match(/rgba?\(([^)]+)\)/);
  const parts = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : [];
  const alpha = parts.length > 3 ? parts[3] : 1;
  // `color: transparent` means the glyphs are painted by a background gradient
  // clipped to the text (bg-clip-text). There is no colour to compare, so the
  // glyph pixels have to be read off the render.
  const gradientText = alpha === 0 || !m;

  let worst = Infinity, worstFg = null, worstBg = null;
  for (let i = 0; i < A.data.length; i += A.ch) {
    const ar = A.data[i], ag = A.data[i + 1], ab = A.data[i + 2];
    const br = B.data[i], bg_ = B.data[i + 1], bb = B.data[i + 2];
    // A pixel belongs to a glyph only if hiding the element changed it.
    const changed = Math.abs(ar - br) + Math.abs(ag - bg_) + Math.abs(ab - bb) > 24;
    if (!changed) continue;
    const fl = gradientText
      ? luminance(ar, ag, ab)
      : luminance(parts[0], parts[1], parts[2]);
    const c = contrast(fl, luminance(br, bg_, bb));
    if (c < worst) { worst = c; worstFg = [ar, ag, ab]; worstBg = [br, bg_, bb]; }
  }
  if (!Number.isFinite(worst)) continue; // no glyph pixels found

  const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
  const required = large ? 3.0 : 4.5;
  results.push({
    ...t, gradientText, worstContrast: +worst.toFixed(2), worstFg, worstBg,
    large, required, passes: worst >= required,
  });
}

console.log(`\nHero contrast — measured against real rendered pixels\n${URL_}\n`);
for (const r of results) {
  console.log(`${r.passes ? 'PASS' : 'FAIL'}  ${r.worstContrast}:1 (needs ${r.required}:1${r.large ? ', large text' : ''})`);
  console.log(`      ${r.selector}  "${r.text}"`);
  console.log(
    `      ${r.gradientText ? 'gradient glyph' : 'color ' + r.color}` +
    `  worst glyph rgb(${r.worstFg?.join(',')})  vs bg rgb(${r.worstBg?.join(',')})`,
  );
}
const failures = results.filter((r) => !r.passes);
console.log(`\n${failures.length} of ${results.length} fail.`);
await browser.close();
process.exit(failures.length ? 1 : 0);
