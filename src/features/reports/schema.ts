import { z } from 'zod';
import { ReportKind } from '@prisma/client';

// ──────────────────────────────────────────────────────────────────────────
// Report content model (CLAUDE.md §13 "Reports").
//
// A report is stored as structured blocks, not as a rendered document, so the
// same saved report can be exported to Word and to Excel and re-exported later
// without regenerating it from the database.
//
// Narrative text carries inline emphasis in a deliberately tiny markup —
// `**bold**` — because that is what the AI polish pass can reliably produce and
// what both exporters can render natively (a Word run with bold: true, an Excel
// cell with a bold font). Anything richer than that would be a formatting
// language nobody asked for.
// ──────────────────────────────────────────────────────────────────────────

export const REPORT_BLOCK_KINDS = ['heading', 'paragraph', 'bullets', 'table', 'kpis'] as const;

const headingBlock = z.object({
  kind: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().trim().min(1).max(300),
});

const paragraphBlock = z.object({
  kind: z.literal('paragraph'),
  /** May contain `**bold**` spans. */
  text: z.string().trim().min(1).max(8000),
});

const bulletsBlock = z.object({
  kind: z.literal('bullets'),
  items: z.array(z.string().trim().min(1).max(2000)).min(1).max(60),
});

const tableBlock = z.object({
  kind: z.literal('table'),
  caption: z.string().trim().max(300).optional(),
  columns: z.array(z.string().trim().max(120)).min(1).max(12),
  rows: z.array(z.array(z.string().max(2000)).max(12)).max(2000),
});

const kpisBlock = z.object({
  kind: z.literal('kpis'),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(60),
        hint: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(12),
});

export const reportBlockSchema = z.discriminatedUnion('kind', [
  headingBlock,
  paragraphBlock,
  bulletsBlock,
  tableBlock,
  kpisBlock,
]);

export type ReportBlock = z.infer<typeof reportBlockSchema>;
export type HeadingBlock = z.infer<typeof headingBlock>;
export type ParagraphBlock = z.infer<typeof paragraphBlock>;
export type BulletsBlock = z.infer<typeof bulletsBlock>;
export type TableBlock = z.infer<typeof tableBlock>;
export type KpisBlock = z.infer<typeof kpisBlock>;

export const reportContentSchema = z.object({
  /** Rendered above the first block in both exports. */
  subtitle: z.string().trim().max(300).optional(),
  blocks: z.array(reportBlockSchema).min(1).max(200),
});

export type ReportContent = z.infer<typeof reportContentSchema>;

/** Safely coerce stored `content` JSON into the canonical shape. */
export function parseReportContent(content: unknown): ReportContent | null {
  const result = reportContentSchema.safeParse(content);
  return result.success ? result.data : null;
}

// ── Inline emphasis ─────────────────────────────────────────────────────────

export interface InlineRun {
  text: string;
  bold: boolean;
}

/**
 * Split narrative text into bold/plain runs on `**…**`.
 *
 * Pure and total: any text at all produces a valid run list. An unmatched `**`
 * is treated as literal text rather than swallowing the rest of the paragraph,
 * because a half-typed marker in a human-edited report must not silently
 * bold everything after it.
 */
export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let rest = text;

  while (rest.length > 0) {
    const open = rest.indexOf('**');
    if (open === -1) {
      runs.push({ text: rest, bold: false });
      break;
    }

    const close = rest.indexOf('**', open + 2);
    if (close === -1) {
      // Unmatched marker: keep it literal.
      runs.push({ text: rest, bold: false });
      break;
    }

    if (open > 0) runs.push({ text: rest.slice(0, open), bold: false });

    const inner = rest.slice(open + 2, close);
    // `****` (empty emphasis) contributes nothing rather than an empty run.
    if (inner.length > 0) runs.push({ text: inner, bold: true });

    rest = rest.slice(close + 2);
  }

  return runs.filter((run) => run.text.length > 0);
}

/** Emphasis stripped — for Excel cells and plain-text previews. */
export function stripInlineMarkup(text: string): string {
  return parseInlineRuns(text)
    .map((run) => run.text)
    .join('');
}

// ── Boundary schemas ────────────────────────────────────────────────────────

const optionalCuid = z
  .union([z.literal(''), z.string().cuid()])
  .optional()
  .transform((v) => (v ? v : null));

export const createReportSchema = z.object({
  kind: z.nativeEnum(ReportKind),
  /** Mentee the report is about. Required for MENTOR_PAIR, ignored otherwise. */
  subjectUserId: optionalCuid,
  /** Blank = the whole programme to date. */
  periodMonths: z.coerce.number().int().min(1).max(36).optional(),
});

export const reportIdSchema = z.object({ reportId: z.string().cuid() });

export const updateReportContentSchema = z.object({
  reportId: z.string().cuid(),
  title: z.string().trim().min(2).max(200),
  content: z
    .string()
    .trim()
    .min(1)
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The report content was malformed.' });
        return z.NEVER;
      }
    })
    .pipe(reportContentSchema),
});

export const EXPORT_FORMATS = ['docx', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Filesystem-safe export filename, e.g. `mentee-progress-report-amina-bello.docx`. */
export function exportFilename(title: string, format: ExportFormat): string {
  const slug =
    title
      .toLowerCase()
      // NFD splits an accented letter into base + combining mark; drop the
      // marks so "Évaluation" slugs to "evaluation" rather than "e-valuation".
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'report';
  return `${slug}.${format}`;
}
