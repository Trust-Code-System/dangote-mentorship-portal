import {
  defaultHeadingFor,
  sendableSections,
  type NewsletterBody,
  type NewsletterSection,
} from './schema';

// ──────────────────────────────────────────────────────────────────────────
// Newsletter email renderer (pure — no I/O, unit tested).
//
// Email clients are not browsers: no external stylesheet, no flexbox worth
// trusting, no <style> in Gmail's mobile app. So the layout is a table with
// inline styles, in the portal's own palette, and every piece of admin-authored
// text is HTML-escaped on the way in. A newsletter is the one thing the portal
// sends to hundreds of inboxes; an unescaped apostrophe or a stray `<` must not
// be able to break it, let alone inject markup.
// ──────────────────────────────────────────────────────────────────────────

const GREEN = '#1f6f4a';
const GREEN_SOFT = '#eef5f1';
const INK = '#1a1a1a';
const INK_MUTED = '#5b6660';
const RULE = '#d8dedA';
const PAPER = '#ffffff';
const CANVAS = '#f4f6f5';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A section's text in `lang`, falling back to the other language. */
export function textFor(section: NewsletterSection, lang: 'EN' | 'FR'): string {
  const preferred = lang === 'FR' ? section.bodyFr : section.bodyEn;
  const fallback = lang === 'FR' ? section.bodyEn : section.bodyFr;
  return preferred.trim() || fallback.trim();
}

export function headingFor(section: NewsletterSection, lang: 'EN' | 'FR'): string {
  const preferred = lang === 'FR' ? section.headingFr : section.headingEn;
  const fallback = lang === 'FR' ? section.headingEn : section.headingFr;
  return preferred.trim() || fallback.trim() || defaultHeadingFor(section.kind, lang);
}

/** Non-empty lines of a section body — one bullet or one stat per line. */
export function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * `Label: value` lines render as a two-column stat row; anything else renders
 * as plain text. Splitting on the FIRST colon only, so "Sessions: 12: see note"
 * keeps its tail in the value.
 */
function splitStat(line: string): { label: string; value: string } | null {
  const at = line.indexOf(':');
  if (at <= 0 || at === line.length - 1) return null;
  return { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
}

function renderSectionHtml(section: NewsletterSection, lang: 'EN' | 'FR'): string {
  const heading = escapeHtml(headingFor(section, lang));
  const text = textFor(section, lang);
  const lines = linesOf(text);

  let inner: string;

  if (section.kind === 'numbers') {
    const rows = lines
      .map((line) => {
        const stat = splitStat(line);
        if (!stat) {
          return `<tr><td colspan="2" style="padding:6px 0;color:${INK};font-size:15px;">${escapeHtml(line)}</td></tr>`;
        }
        return `<tr><td style="padding:6px 12px 6px 0;color:${INK_MUTED};font-size:14px;">${escapeHtml(stat.label)}</td><td style="padding:6px 0;color:${INK};font-size:18px;font-weight:700;text-align:right;">${escapeHtml(stat.value)}</td></tr>`;
      })
      .join('');
    inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${GREEN_SOFT};border-radius:8px;padding:8px 16px;"><tbody>${rows}</tbody></table>`;
  } else if (section.kind === 'highlights' || section.kind === 'dates') {
    inner = `<ul style="margin:0;padding-left:20px;color:${INK};font-size:15px;line-height:1.6;">${lines
      .map((line) => `<li style="margin-bottom:6px;">${escapeHtml(line)}</li>`)
      .join('')}</ul>`;
  } else {
    inner = lines
      .map(
        (line) =>
          `<p style="margin:0 0 10px;color:${INK};font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`,
      )
      .join('');
  }

  return [
    `<tr><td style="padding:20px 28px 0;">`,
    `<h2 style="margin:0 0 10px;color:${GREEN};font-size:16px;letter-spacing:0.04em;text-transform:uppercase;">${heading}</h2>`,
    inner,
    `</td></tr>`,
  ].join('');
}

export interface NewsletterRenderMeta {
  /** Email subject, already chosen for the recipient's language. */
  subject: string;
  programmeName: string;
  cohortName: string;
  /** Localized issue date, e.g. "7 September 2026". */
  issueDate: string;
  /** Absolute portal URL for the footer link, or null to omit it. */
  portalUrl?: string | null;
  footerNote: string;
}

/** Full HTML email for one recipient language. */
export function renderNewsletterHtml(
  body: NewsletterBody,
  lang: 'EN' | 'FR',
  meta: NewsletterRenderMeta,
): string {
  const sections = sendableSections(body)
    .map((section) => renderSectionHtml(section, lang))
    .join('');

  const footerLink = meta.portalUrl
    ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(meta.portalUrl)}" style="color:${GREEN};text-decoration:underline;">${escapeHtml(meta.programmeName)}</a></p>`
    : '';

  return [
    `<!doctype html><html lang="${lang.toLowerCase()}"><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${escapeHtml(meta.subject)}</title></head>`,
    `<body style="margin:0;padding:24px 12px;background:${CANVAS};font-family:'Public Sans',Helvetica,Arial,sans-serif;">`,
    // Preheader: shown in the inbox preview, hidden in the body.
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(meta.subject)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px;background:${PAPER};border:1px solid ${RULE};border-radius:12px;overflow:hidden;">`,
    `<tbody>`,
    `<tr><td style="padding:24px 28px 4px;border-bottom:1px solid ${RULE};">`,
    `<p style="margin:0;color:${INK_MUTED};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(meta.programmeName)}</p>`,
    `<h1 style="margin:6px 0 4px;color:${INK};font-size:22px;line-height:1.3;">${escapeHtml(meta.subject)}</h1>`,
    `<p style="margin:0 0 18px;color:${INK_MUTED};font-size:13px;">${escapeHtml(meta.cohortName)} · ${escapeHtml(meta.issueDate)}</p>`,
    `</td></tr>`,
    sections,
    `<tr><td style="padding:24px 28px 26px;">`,
    `<hr style="border:none;border-top:1px solid ${RULE};margin:0 0 12px;">`,
    `<p style="margin:0;color:${INK_MUTED};font-size:12px;line-height:1.5;">${escapeHtml(meta.footerNote)}</p>`,
    footerLink,
    `</td></tr>`,
    `</tbody></table>`,
    `</td></tr></table></body></html>`,
  ].join('');
}

/** Plain-text alternative — required by the mail transport, and the fallback
 *  every client can render. */
export function renderNewsletterText(
  body: NewsletterBody,
  lang: 'EN' | 'FR',
  meta: NewsletterRenderMeta,
): string {
  const parts: string[] = [
    meta.programmeName.toUpperCase(),
    meta.subject,
    `${meta.cohortName} · ${meta.issueDate}`,
    '',
  ];

  for (const section of sendableSections(body)) {
    parts.push(headingFor(section, lang).toUpperCase());
    const lines = linesOf(textFor(section, lang));
    const bulleted = section.kind === 'highlights' || section.kind === 'dates';
    for (const line of lines) parts.push(bulleted ? `- ${line}` : line);
    parts.push('');
  }

  parts.push('—', meta.footerNote);
  if (meta.portalUrl) parts.push(meta.portalUrl);

  return parts.join('\n');
}
