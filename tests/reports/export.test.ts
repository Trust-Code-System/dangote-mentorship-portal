import { describe, expect, it, vi } from 'vitest';

// The exporters are `server-only` modules; under Vitest that guard has no
// meaning, so stub it out (same pattern as tests/messages).
vi.mock('server-only', () => ({}));
import * as XLSX from 'xlsx';
import { renderReportDocx } from '@/features/reports/docx';
import { renderReportXlsx } from '@/features/reports/xlsx';
import type { ReportContent } from '@/features/reports/schema';

// Smoke tests that assert the exporters produce real, openable Office files —
// not just that they returned bytes. A .docx/.xlsx is a ZIP, so both must start
// with the ZIP local-file-header magic "PK\x03\x04", and the workbook is read
// back to confirm the sheets and values landed where they should.

const content: ReportContent = {
  subtitle: 'Programme to date, as at 2026-09-07',
  blocks: [
    {
      kind: 'kpis',
      items: [
        { label: 'Goals set', value: '4' },
        { label: 'Sessions logged', value: '6', hint: '86%' },
      ],
    },
    { kind: 'heading', level: 2, text: 'Development goals' },
    { kind: 'paragraph', text: 'The mentee met **all four** goals this quarter.' },
    { kind: 'bullets', items: ['Met **6** times', 'Completed the leadership module'] },
    {
      kind: 'table',
      caption: 'Goals',
      columns: ['Goal', 'Status', 'Sessions'],
      rows: [
        ['Lead the weekly review', 'Approved', '6'],
        ['Present to the board', 'In progress', '2'],
      ],
    },
  ],
};

const meta = {
  title: 'Programme report — Cohort 2026',
  organisation: 'BLAK MOH Mentorship Programme',
  generatedOn: '7 September 2026',
  author: 'Aisha Eze',
};

describe('renderReportDocx', () => {
  it('produces a ZIP-framed Word document', async () => {
    const buffer = await renderReportDocx(content, meta);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString('binary')).toBe('PK');
  });

  it('contains the OOXML document part', async () => {
    const buffer = await renderReportDocx(content, meta);
    // Entry names are stored uncompressed in the ZIP central directory.
    expect(buffer.toString('binary')).toContain('word/document.xml');
  });

  it('renders a report with only a single block', async () => {
    const buffer = await renderReportDocx(
      { blocks: [{ kind: 'paragraph', text: 'Nothing to report.' }] },
      meta,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('renders a table with ragged rows without throwing', async () => {
    const buffer = await renderReportDocx(
      {
        blocks: [
          { kind: 'table', columns: ['A', 'B', 'C'], rows: [['1'], ['1', '2', '3']] },
        ],
      },
      meta,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe('renderReportXlsx', () => {
  it('produces a ZIP-framed workbook', () => {
    const buffer = renderReportXlsx(content, meta);
    expect(buffer.subarray(0, 4).toString('binary')).toBe('PK');
  });

  it('puts each table on its own sheet alongside the summary', () => {
    const workbook = XLSX.read(renderReportXlsx(content, meta), { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Summary', 'Goals']);
  });

  it('strips inline markup from cells and keeps numbers numeric', () => {
    const workbook = XLSX.read(renderReportXlsx(content, meta), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Goals!);
    expect(rows[0]).toEqual({ Goal: 'Lead the weekly review', Status: 'Approved', Sessions: 6 });
  });

  it('keeps the narrative on the summary sheet without markup', () => {
    const workbook = XLSX.read(renderReportXlsx(content, meta), { type: 'buffer' });
    const text = XLSX.utils.sheet_to_csv(workbook.Sheets.Summary!);
    expect(text).toContain('The mentee met all four goals this quarter.');
    expect(text).not.toContain('**');
  });

  it('gives two identically captioned tables distinct sheet names', () => {
    const workbook = XLSX.read(
      renderReportXlsx(
        {
          blocks: [
            { kind: 'table', caption: 'Goals', columns: ['A'], rows: [['1']] },
            { kind: 'table', caption: 'Goals', columns: ['A'], rows: [['2']] },
          ],
        },
        meta,
      ),
      { type: 'buffer' },
    );
    expect(workbook.SheetNames).toEqual(['Summary', 'Goals', 'Goals (2)']);
  });

  it('truncates an over-long caption to a legal sheet name', () => {
    const workbook = XLSX.read(
      renderReportXlsx(
        {
          blocks: [
            {
              kind: 'table',
              caption: 'Quarterly assessment compliance by department and location',
              columns: ['A'],
              rows: [['1']],
            },
          ],
        },
        meta,
      ),
      { type: 'buffer' },
    );
    const [, tableSheet] = workbook.SheetNames;
    expect(tableSheet!.length).toBeLessThanOrEqual(31);
  });

  it('sanitizes characters Excel forbids in a sheet name', () => {
    const workbook = XLSX.read(
      renderReportXlsx(
        {
          blocks: [
            { kind: 'table', caption: 'Goals [Q1]/Q2:*?', columns: ['A'], rows: [['1']] },
          ],
        },
        meta,
      ),
      { type: 'buffer' },
    );
    const [, tableSheet] = workbook.SheetNames;
    expect(tableSheet).not.toMatch(/[[\]:*?/\\]/);
  });
});
