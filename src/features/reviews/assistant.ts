import type { FieldAggregate } from './aggregate';
import { pickLanguageText } from '@/features/cohorts/languages';

// Pure AI Review Assistant logic (CLAUDE.md §9.4). No I/O: the prompt builder
// and the defensive parser are unit-tested so the AI boundary is tested in
// isolation. The assistant only ever SUGGESTS — the drafted summary lands
// editable and a human saves it (CLAUDE.md §0 rule 5). Everything the model sees
// is grounded in real aggregates passed server-side; the prompt forbids
// inventing facts.

export type Lang = 'EN' | 'FR';

export interface ReviewReportFacts {
  type: 'MIDTERM' | 'FINAL';
  eligible: number;
  submitted: number;
  percent: number;
  /** One readable line per question, already rolled up. */
  questionLines: string[];
  /** "Mentor · Mentee" labels for pairs with an incomplete review. */
  pairsMissing: string[];
}

export interface ReviewReport {
  summary: string;
  atRisk: string[];
  recommendations: string[];
}

/** Render one aggregate as a compact, human-readable line for the prompt. */
export function aggregateToLine(agg: FieldAggregate, lang: Lang): string {
  const label = pickLanguageText(lang, { EN: agg.labelEn, FR: agg.labelFr });
  switch (agg.type) {
    case 'rating':
      return `${label}: average ${agg.average ?? 'n/a'}/${agg.max} (${agg.answered} responses)`;
    case 'single_select': {
      const parts = agg.counts.map(
        (c) => `${pickLanguageText(lang, { EN: c.labelEn, FR: c.labelFr })}=${c.count}`,
      );
      return `${label}: ${parts.join(', ')}`;
    }
    case 'boolean':
      return `${label}: yes=${agg.yes}, no=${agg.no}`;
    default:
      return `${label}: ${agg.answered} written responses`;
  }
}

/** Build the Review Assistant prompt. Pure so the exact instruction is testable. */
export function buildReviewReportPrompt(facts: ReviewReportFacts, lang: Lang): string {
  const languageName = lang === 'FR' ? 'French' : 'English';
  const reviewName = facts.type === 'MIDTERM' ? 'mid-term' : 'final';
  const lines = facts.questionLines.length
    ? facts.questionLines.map((l) => `- ${l}`).join('\n')
    : '(no quantitative questions)';
  const missing = facts.pairsMissing.length
    ? facts.pairsMissing.map((p) => `- ${p}`).join('\n')
    : '(all pairs have completed this review)';

  return [
    `Respond in ${languageName}.`,
    `You are the Review Assistant for a corporate mentorship programme. Draft a concise`,
    `${reviewName} review report for the programme team using ONLY the facts below.`,
    'Do not invent numbers, names, or outcomes that are not present. Return ONLY strict',
    'JSON of this shape:',
    '{',
    '  "summary": string,           // 2-4 sentences on overall progress and engagement',
    '  "atRisk": [string],          // short phrases naming concerns (e.g. low completion, specific pairs)',
    '  "recommendations": [string]  // 2-4 concrete next steps for the programme team',
    '}',
    'Base "atRisk" only on the completion figures and the pairs-missing list provided.',
    '',
    `Review: ${reviewName}`,
    `Completion: ${facts.submitted} of ${facts.eligible} eligible participants (${facts.percent}%).`,
    'Question roll-up:',
    lines,
    'Pairs with an incomplete review:',
    missing,
  ].join('\n');
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const entry of v) {
    const s = str(entry);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Defensive parser for the assistant's JSON. Returns null on anything unusable so
 * the caller falls back to "no suggestion" rather than throwing. Tolerates models
 * that wrap JSON in prose/code fences.
 */
export function parseReviewReportResponse(raw: string): ReviewReport | null {
  if (!raw || !raw.trim()) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const report: ReviewReport = {
    summary: str(obj.summary),
    atRisk: strList(obj.atRisk, 12),
    recommendations: strList(obj.recommendations, 8),
  };

  if (!report.summary && report.atRisk.length === 0 && report.recommendations.length === 0) {
    return null;
  }
  return report;
}
