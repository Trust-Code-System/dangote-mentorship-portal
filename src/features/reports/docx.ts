import 'server-only';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { parseInlineRuns, type ReportBlock, type ReportContent } from './schema';

// Word (.docx) renderer for a saved report (CLAUDE.md §13 export).
//
// Real OOXML rather than an HTML file with a .doc extension, so the document
// opens without a compatibility warning and the formatting the AI polish pass
// produced — headings, bold emphasis, bullet lists, tables — survives into a
// document the recipient can keep editing.

const BRAND_GREEN = '1F6F4A';
const INK = '1A1A1A';
const INK_MUTED = '5B6660';
const RULE = 'D8DEDA';

/** Inline `**bold**` markup → Word runs. */
function textRuns(text: string, options: { size?: number; color?: string } = {}): TextRun[] {
  return parseInlineRuns(text).map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        size: options.size,
        color: options.color,
      }),
  );
}

function headingLevel(level: 1 | 2 | 3) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function renderBlock(block: ReportBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'heading':
      return [
        new Paragraph({
          heading: headingLevel(block.level),
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({ text: block.text, bold: true, color: block.level === 1 ? BRAND_GREEN : INK }),
          ],
        }),
      ];

    case 'paragraph':
      return [
        new Paragraph({
          spacing: { after: 160, line: 300 },
          children: textRuns(block.text, { color: INK }),
        }),
      ];

    case 'bullets':
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80, line: 280 },
            children: textRuns(item, { color: INK }),
          }),
      );

    case 'kpis': {
      // A KPI row reads best in Word as a two-column label/value table.
      const rows = block.items.map(
        (item) =>
          new TableRow({
            children: [
              cell([new Paragraph({ children: [new TextRun({ text: item.label, color: INK_MUTED })] })]),
              cell([
                new Paragraph({
                  children: [new TextRun({ text: item.value, bold: true, color: INK })],
                }),
                ...(item.hint
                  ? [
                      new Paragraph({
                        children: [new TextRun({ text: item.hint, size: 18, color: INK_MUTED })],
                      }),
                    ]
                  : []),
              ]),
            ],
          }),
      );
      return [
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ text: '', spacing: { after: 160 } }),
      ];
    }

    case 'table': {
      const header = new TableRow({
        tableHeader: true,
        children: block.columns.map((column) =>
          cell([
            new Paragraph({
              children: [new TextRun({ text: column, bold: true, color: BRAND_GREEN })],
            }),
          ]),
        ),
      });

      const body = block.rows.map(
        (row) =>
          new TableRow({
            children: block.columns.map((_, index) =>
              cell([
                new Paragraph({
                  children: textRuns(row[index] ?? '', { color: INK }),
                }),
              ]),
            ),
          }),
      );

      const parts: (Paragraph | Table)[] = [];
      if (block.caption) {
        parts.push(
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: block.caption, bold: true, color: INK })],
          }),
        );
      }
      parts.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }),
      );
      parts.push(new Paragraph({ text: '', spacing: { after: 160 } }));
      return parts;
    }
  }
}

function cell(children: Paragraph[]): TableCell {
  return new TableCell({
    children,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
  });
}

export interface DocxMeta {
  title: string;
  /** e.g. "BLAK MOH · Cohort 2026" — printed under the title. */
  organisation: string;
  /** Rendered in the footer line, already localized by the caller. */
  generatedOn: string;
  author: string;
}

/** Render a saved report to a .docx byte buffer. */
export async function renderReportDocx(
  content: ReportContent,
  meta: DocxMeta,
): Promise<Buffer> {
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: meta.organisation.toUpperCase(), size: 16, color: INK_MUTED, bold: true }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      children: [new TextRun({ text: meta.title, bold: true, color: INK })],
    }),
  ];

  if (content.subtitle) {
    body.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: content.subtitle, color: INK_MUTED })],
      }),
    );
  }

  for (const block of content.blocks) {
    body.push(...renderBlock(block));
  }

  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360 },
      children: [
        new TextRun({
          text: `${meta.generatedOn} · ${meta.author}`,
          size: 16,
          color: INK_MUTED,
        }),
      ],
    }),
  );

  const document = new Document({
    creator: meta.author,
    title: meta.title,
    description: content.subtitle ?? meta.title,
    sections: [{ children: body }],
  });

  return Packer.toBuffer(document);
}
