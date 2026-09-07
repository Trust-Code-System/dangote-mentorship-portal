import { describe, expect, it } from 'vitest';
import { emptyNewsletterBody, type NewsletterBody } from '@/features/newsletters/schema';
import {
  escapeHtml,
  headingFor,
  linesOf,
  renderNewsletterHtml,
  renderNewsletterText,
  textFor,
} from '@/features/newsletters/template';

const meta = {
  subject: 'This week in mentorship',
  programmeName: 'BLAK MOH Mentorship Programme',
  cohortName: 'Cohort 2026',
  issueDate: '7 September 2026',
  portalUrl: 'https://portal.example.com',
  footerNote: 'You receive this because you are enrolled in the programme.',
};

function bodyWith(overrides: Partial<NewsletterBody['sections'][number]>[]): NewsletterBody {
  const body = emptyNewsletterBody();
  overrides.forEach((override, index) => {
    body.sections[index] = { ...body.sections[index]!, ...override };
  });
  return body;
}

describe('escapeHtml', () => {
  it('escapes every character that could break out of markup', () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Sessions logged: 12')).toBe('Sessions logged: 12');
  });
});

describe('textFor / headingFor', () => {
  const section = {
    kind: 'intro' as const,
    headingEn: 'Welcome',
    headingFr: '',
    bodyEn: 'Hello everyone',
    bodyFr: '',
    enabled: true,
  };

  it('prefers the recipient language', () => {
    expect(textFor({ ...section, bodyFr: 'Bonjour' }, 'FR')).toBe('Bonjour');
  });

  it('falls back to the other language rather than dropping the section', () => {
    expect(textFor(section, 'FR')).toBe('Hello everyone');
    expect(headingFor(section, 'FR')).toBe('Welcome');
  });

  it('falls back to the default heading when both are blank', () => {
    expect(headingFor({ ...section, headingEn: '' }, 'FR')).toBe(
      'Cette semaine dans le programme',
    );
  });
});

describe('linesOf', () => {
  it('drops blank lines and trims each line', () => {
    expect(linesOf('  one \n\n  two  \n')).toEqual(['one', 'two']);
  });

  it('returns [] for empty text', () => {
    expect(linesOf('   \n  ')).toEqual([]);
  });
});

describe('renderNewsletterHtml', () => {
  it('renders the subject, cohort and issue date in the header', () => {
    const html = renderNewsletterHtml(bodyWith([{ bodyEn: 'Hello' }]), 'EN', meta);
    expect(html).toContain('This week in mentorship');
    expect(html).toContain('Cohort 2026');
    expect(html).toContain('7 September 2026');
  });

  it('escapes admin-authored text — markup cannot be injected', () => {
    const html = renderNewsletterHtml(
      bodyWith([{ bodyEn: '<img src=x onerror=alert(1)>' }]),
      'EN',
      meta,
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes the subject line too', () => {
    const html = renderNewsletterHtml(bodyWith([{ bodyEn: 'Hi' }]), 'EN', {
      ...meta,
      subject: 'Q3 <b>results</b>',
    });
    expect(html).not.toContain('<b>results</b>');
  });

  it('renders highlights as a list and numbers as label/value rows', () => {
    const body = bodyWith([
      {},
      { bodyEn: 'First thing\nSecond thing' },
      { bodyEn: 'Sessions logged: 42' },
    ]);
    const html = renderNewsletterHtml(body, 'EN', meta);
    expect(html).toContain('<li style="margin-bottom:6px;">First thing</li>');
    expect(html).toContain('Sessions logged');
    expect(html).toContain('42');
  });

  it('keeps a colon-less numbers line readable rather than dropping it', () => {
    const body = bodyWith([{}, {}, { bodyEn: 'Engagement is up across the board' }]);
    expect(renderNewsletterHtml(body, 'EN', meta)).toContain(
      'Engagement is up across the board',
    );
  });

  it('omits sections that are empty or disabled', () => {
    const body = bodyWith([
      { bodyEn: 'Included' },
      { bodyEn: 'Hidden', enabled: false },
    ]);
    const html = renderNewsletterHtml(body, 'EN', meta);
    expect(html).toContain('Included');
    expect(html).not.toContain('Hidden');
  });

  it('omits the portal link when no URL is configured', () => {
    const html = renderNewsletterHtml(bodyWith([{ bodyEn: 'Hi' }]), 'EN', {
      ...meta,
      portalUrl: null,
    });
    expect(html).not.toContain('<a href');
  });

  it('sets the html lang attribute for the recipient language', () => {
    expect(renderNewsletterHtml(bodyWith([{ bodyFr: 'Bonjour' }]), 'FR', meta)).toContain(
      '<html lang="fr">',
    );
  });

  it('produces a document even when nothing is sendable', () => {
    const html = renderNewsletterHtml(emptyNewsletterBody(), 'EN', meta);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain(meta.footerNote);
  });
});

describe('renderNewsletterText', () => {
  it('renders headings, bullets and the footer as plain text', () => {
    const body = bodyWith([{ bodyEn: 'Welcome back.' }, { bodyEn: 'One\nTwo' }]);
    const text = renderNewsletterText(body, 'EN', meta);
    expect(text).toContain('THIS WEEK IN THE PROGRAMME');
    expect(text).toContain('Welcome back.');
    expect(text).toContain('- One');
    expect(text).toContain(meta.footerNote);
    expect(text).toContain(meta.portalUrl);
  });

  it('contains no HTML tags or entities', () => {
    const body = bodyWith([{ bodyEn: 'A & B <c>' }]);
    const text = renderNewsletterText(body, 'EN', meta);
    expect(text).toContain('A & B <c>');
    expect(text).not.toContain('&amp;');
  });
});
