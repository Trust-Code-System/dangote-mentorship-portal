import 'server-only';
import * as XLSX from 'xlsx';
import { stripInlineMarkup, type ReportContent } from './schema';

// Excel (.xlsx) renderer for a saved report (CLAUDE.md §13 export).
//
// Word gets the narrative; Excel gets the numbers. Every table block becomes
// its own worksheet so the recipient can sort, filter and pivot it, and a lead
// "Summary" sheet carries the title, the KPI row and the narrative text so the
// workbook still reads on its own.
//
// Inline `**bold**` markup is stripped here: a cell's value should be the value,
// not the markup. (SheetJS's community build cannot write per-run cell styling,
// so bolding inside a cell is not available either way.)

const SUMMARY_SHEET = 'Summary';

/** Excel sheet names: ≤31 chars, no []:*?/\ — and unique within the workbook. */
function safeSheetName(name: string, taken: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';

  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  // Append a counter, trimming the base so the result still fits in 31 chars.
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  const fallback = base.slice(0, 26) + Math.random().toString(36).slice(2, 7);
  taken.add(fallback);
  return fallback;
}

/** Column widths from the widest cell, so nothing opens as `####`. */
function columnWidths(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const length = String(cell ?? '').length;
      widths[index] = Math.max(widths[index] ?? 10, Math.min(60, length + 2));
    });
  }
  return widths.map((wch) => ({ wch }));
}

export interface XlsxMeta {
  title: string;
  organisation: string;
  generatedOn: string;
  author: string;
}

export function renderReportXlsx(content: ReportContent, meta: XlsxMeta): Buffer {
  const workbook = XLSX.utils.book_new();
  const taken = new Set<string>([SUMMARY_SHEET]);

  // ── Summary sheet ────────────────────────────────────────────────────────
  const summary: (string | number)[][] = [
    [meta.organisation],
    [meta.title],
    ...(content.subtitle ? [[content.subtitle]] : []),
    [`${meta.generatedOn} · ${meta.author}`],
    [],
  ];

  for (const block of content.blocks) {
    switch (block.kind) {
      case 'heading':
        summary.push([], [stripInlineMarkup(block.text).toUpperCase()]);
        break;
      case 'paragraph':
        summary.push([stripInlineMarkup(block.text)]);
        break;
      case 'bullets':
        for (const item of block.items) summary.push([`• ${stripInlineMarkup(item)}`]);
        break;
      case 'kpis':
        summary.push([]);
        for (const item of block.items) {
          summary.push([item.label, item.value, item.hint ?? '']);
        }
        break;
      case 'table':
        // Tables live on their own sheets; the summary just points at them.
        summary.push([block.caption ? `${block.caption} → own sheet` : 'Table → own sheet']);
        break;
    }
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = columnWidths(summary);
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET);

  // ── One sheet per table ──────────────────────────────────────────────────
  let index = 1;
  for (const block of content.blocks) {
    if (block.kind !== 'table') continue;

    const rows: (string | number)[][] = [
      block.columns.map((column) => stripInlineMarkup(column)),
      ...block.rows.map((row) =>
        block.columns.map((_, i) => coerceCell(stripInlineMarkup(row[i] ?? ''))),
      ),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = columnWidths(rows);
    // Freeze the header row and turn on autofilter — this is a working sheet.
    sheet['!freeze'] = { xSplit: '0', ySplit: '1' };
    if (block.rows.length > 0) {
      sheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: block.rows.length, c: Math.max(0, block.columns.length - 1) },
        }),
      };
    }

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      safeSheetName(block.caption ?? `Table ${index}`, taken),
    );
    index += 1;
  }

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out;
}

/**
 * Keep numbers numeric so Excel can sum them, while leaving anything
 * number-adjacent (percentages, "3/5", dates, ids) as text.
 */
function coerceCell(value: string): string | number {
  if (value === '') return '';
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}
