import { describe, expect, it } from 'vitest';
import {
  exportFilename,
  parseInlineRuns,
  parseReportContent,
  stripInlineMarkup,
} from '@/features/reports/schema';

describe('parseInlineRuns', () => {
  it('returns a single plain run for text with no markup', () => {
    expect(parseInlineRuns('Sessions logged this quarter')).toEqual([
      { text: 'Sessions logged this quarter', bold: false },
    ]);
  });

  it('splits a bold span out of the middle', () => {
    expect(parseInlineRuns('She completed **4 of 4** assessments.')).toEqual([
      { text: 'She completed ', bold: false },
      { text: '4 of 4', bold: true },
      { text: ' assessments.', bold: false },
    ]);
  });

  it('handles bold at the very start and end', () => {
    expect(parseInlineRuns('**Mentor:** Aisha Eze')).toEqual([
      { text: 'Mentor:', bold: true },
      { text: ' Aisha Eze', bold: false },
    ]);
    expect(parseInlineRuns('Progress is **strong**')).toEqual([
      { text: 'Progress is ', bold: false },
      { text: 'strong', bold: true },
    ]);
  });

  it('handles several bold spans', () => {
    expect(parseInlineRuns('**A** and **B**')).toEqual([
      { text: 'A', bold: true },
      { text: ' and ', bold: false },
      { text: 'B', bold: true },
    ]);
  });

  it('keeps an unmatched marker literal instead of bolding the rest', () => {
    expect(parseInlineRuns('Growth of **20% year on year')).toEqual([
      { text: 'Growth of **20% year on year', bold: false },
    ]);
  });

  it('drops empty emphasis rather than emitting an empty run', () => {
    expect(parseInlineRuns('before****after')).toEqual([
      { text: 'before', bold: false },
      { text: 'after', bold: false },
    ]);
  });

  it('never returns empty-text runs', () => {
    for (const input of ['**bold**', '', '****', '** **']) {
      expect(parseInlineRuns(input).every((run) => run.text.length > 0)).toBe(true);
    }
  });

  it('round-trips to the original text when markup is stripped', () => {
    const text = 'Mentee **Amina Bello** logged **6** sessions and met **all** goals.';
    expect(stripInlineMarkup(text)).toBe(
      'Mentee Amina Bello logged 6 sessions and met all goals.',
    );
  });
});

describe('parseReportContent', () => {
  it('accepts a well-formed report', () => {
    const parsed = parseReportContent({
      subtitle: 'Programme to date',
      blocks: [
        { kind: 'heading', level: 2, text: 'Goals' },
        { kind: 'paragraph', text: 'Progress is **strong**.' },
        { kind: 'bullets', items: ['One', 'Two'] },
        { kind: 'table', columns: ['A', 'B'], rows: [['1', '2']] },
        { kind: 'kpis', items: [{ label: 'Goals', value: '4' }] },
      ],
    });
    expect(parsed?.blocks).toHaveLength(5);
  });

  it('rejects an unknown block kind', () => {
    expect(parseReportContent({ blocks: [{ kind: 'video', src: 'x' }] })).toBeNull();
  });

  it('rejects an empty report', () => {
    expect(parseReportContent({ blocks: [] })).toBeNull();
  });

  it('rejects a non-object', () => {
    expect(parseReportContent('a report')).toBeNull();
    expect(parseReportContent(null)).toBeNull();
  });
});

describe('exportFilename', () => {
  it('slugifies the title and appends the format', () => {
    expect(exportFilename('Programme report — Cohort 2026', 'docx')).toBe(
      'programme-report-cohort-2026.docx',
    );
  });

  it('strips accents down to ASCII', () => {
    expect(exportFilename('Évaluation trimestrielle', 'xlsx')).toBe(
      'evaluation-trimestrielle.xlsx',
    );
  });

  it('falls back to "report" when nothing survives slugification', () => {
    expect(exportFilename('—— ??', 'docx')).toBe('report.docx');
  });

  it('never emits a path separator or leading dot', () => {
    const name = exportFilename('../../etc/passwd', 'xlsx');
    expect(name).toBe('etc-passwd.xlsx');
    expect(name).not.toMatch(/[/\\]/);
  });
});
