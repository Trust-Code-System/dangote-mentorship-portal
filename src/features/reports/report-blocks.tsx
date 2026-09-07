'use client';

import { parseInlineRuns, type ReportBlock, type ReportContent } from './schema';

// On-screen preview of a report, using the same block model the Word and Excel
// exporters read — so what the author approves is what the exported document
// contains.

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInlineRuns(text).map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold text-ink">
            {run.text}
          </strong>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case 'heading': {
      const className =
        block.level === 1
          ? 'font-display text-h1 text-ink'
          : block.level === 2
            ? 'font-display text-h2 text-ink'
            : 'text-h3 text-ink';
      if (block.level === 1) return <h2 className={className}>{block.text}</h2>;
      if (block.level === 2) return <h3 className={className}>{block.text}</h3>;
      return <h4 className={className}>{block.text}</h4>;
    }

    case 'paragraph':
      return (
        <p className="text-body text-ink-2">
          <Inline text={block.text} />
        </p>
      );

    case 'bullets':
      return (
        <ul className="list-disc space-y-1 pl-5 text-body text-ink-2">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );

    case 'kpis':
      return (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-surface-2 p-3">
              <dt className="text-small text-ink-3">{item.label}</dt>
              <dd className="font-display text-h2 tabular-nums text-ink">
                {item.value}
                {item.hint ? (
                  <span className="ml-2 text-small font-normal text-ink-3">{item.hint}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      );

    case 'table':
      return (
        <figure className="space-y-2">
          {block.caption ? (
            <figcaption className="text-small font-semibold text-ink">{block.caption}</figcaption>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-small">
              <thead>
                <tr className="bg-surface-2 text-left">
                  {block.columns.map((column) => (
                    <th key={column} className="px-3 py-2 font-semibold text-ink">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border">
                    {block.columns.map((_, columnIndex) => (
                      <td key={columnIndex} className="px-3 py-2 align-top text-ink-2">
                        <Inline text={row[columnIndex] ?? ''} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
  }
}

export function ReportBlocks({ content }: { content: ReportContent }) {
  return (
    <div className="space-y-4">
      {content.subtitle ? <p className="text-small text-ink-3">{content.subtitle}</p> : null}
      {content.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
