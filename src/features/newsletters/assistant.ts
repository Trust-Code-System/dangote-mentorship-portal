import {
  NEWSLETTER_SECTION_KINDS,
  newsletterBodySchema,
  type NewsletterBody,
  type NewsletterSectionKind,
} from './schema';
import type { NewsletterDigest } from './digest';

// Newsletter Assistant (CLAUDE.md §9.5). It drafts the issue from the factual
// digest; the admin then edits and approves. The assistant never sends, and it
// never writes to the database — `mergeAssistantDraft` returns a body the
// composer displays, which is only persisted when the admin saves (§0 rule 5,
// §16).

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : 'date to be confirmed';
}

/** Facts, as plain lines. The digest carries no names — nor does this prompt. */
export function digestLines(digest: NewsletterDigest): string[] {
  const lines = [
    `Cohort: ${digest.cohortName}`,
    `Reporting period: the last ${digest.periodDays} days`,
    `Goals approved in period: ${digest.goalsApproved}`,
    `Goals submitted for approval in period: ${digest.goalsSubmitted}`,
    `Mentoring sessions logged in period: ${digest.sessionsLogged}`,
    `Meetings scheduled in the next 3 weeks: ${digest.meetingsScheduled}`,
    `Action items completed in period: ${digest.actionsCompleted}`,
    `Action items still open: ${digest.actionsOpen}`,
    `Pairs that logged a session in period: ${digest.activePairs} of ${digest.totalPairs}`,
  ];

  for (const assessment of digest.upcomingAssessments) {
    lines.push(
      `Upcoming assessment "${assessment.label}" due ${formatDate(assessment.dueAt)} — ${assessment.submitted} of ${assessment.total} mentees have submitted`,
    );
  }
  for (const clinic of digest.upcomingClinics) {
    lines.push(`Upcoming clinic "${clinic.title}" on ${formatDate(clinic.scheduledAt)}`);
  }

  return lines;
}

export function buildDraftPrompt(digest: NewsletterDigest): {
  system: string;
  prompt: string;
} {
  const system = [
    'You write the internal newsletter for a corporate mentorship programme.',
    'Tone: warm, plain, specific. Short sentences. No marketing language, no exclamation marks, no emoji.',
    'You are given facts from the programme portal. Use ONLY those facts. Never invent a number, a name, a date or a story.',
    'Write every section in BOTH English and French (professional French, not a literal translation).',
    'Section rules:',
    '- intro: two or three sentences of context for the week.',
    '- highlights: 2 to 4 lines, ONE per line, no bullet characters.',
    '- numbers: one "Label: value" pair per line, at most five lines, taken verbatim from the facts.',
    '- dates: one upcoming date per line, formatted "What — when". Omit the section if there are no dates in the facts.',
    '- callToAction: one or two sentences telling participants what to do next.',
    'Do NOT write a spotlight section: a real story has to come from a person, not from you.',
    'Also write a subject line in each language: under 70 characters, specific, no colon-prefixed labels.',
    'Return ONLY JSON in exactly this shape:',
    '{"subjectEn":"…","subjectFr":"…","sections":[{"kind":"intro","bodyEn":"…","bodyFr":"…"}]}',
  ].join(' ');

  const prompt = ['Facts from the portal:', ...digestLines(digest).map((l) => `- ${l}`)].join('\n');
  return { system, prompt };
}

export interface AssistantDraft {
  subjectEn: string;
  subjectFr: string;
  sections: { kind: NewsletterSectionKind; bodyEn: string; bodyFr: string }[];
}

const KINDS = new Set<string>(NEWSLETTER_SECTION_KINDS);

/**
 * Parse the assistant's reply. Tolerant of prose or fences around the JSON, and
 * total: an unusable reply yields null and the composer simply stays as it was.
 */
export function parseAssistantDraft(raw: string): AssistantDraft | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const sections: AssistantDraft['sections'] = [];

  if (Array.isArray(record.sections)) {
    for (const entry of record.sections) {
      if (typeof entry !== 'object' || entry === null) continue;
      const section = entry as Record<string, unknown>;
      const kind = typeof section.kind === 'string' ? section.kind : '';
      if (!KINDS.has(kind)) continue;
      sections.push({
        kind: kind as NewsletterSectionKind,
        bodyEn: typeof section.bodyEn === 'string' ? section.bodyEn.trim() : '',
        bodyFr: typeof section.bodyFr === 'string' ? section.bodyFr.trim() : '',
      });
    }
  }

  const subjectEn = typeof record.subjectEn === 'string' ? record.subjectEn.trim() : '';
  const subjectFr = typeof record.subjectFr === 'string' ? record.subjectFr.trim() : '';

  if (sections.length === 0 && !subjectEn && !subjectFr) return null;
  return { subjectEn, subjectFr, sections };
}

/**
 * Fold an assistant draft into the existing composer body.
 *
 * The section list, its order and the admin's own headings are never replaced —
 * only the body text of sections the assistant actually returned, and only where
 * it returned something. So a partial or garbled reply degrades to "some
 * sections got filled in", never to a mangled newsletter, and re-running the
 * assistant cannot delete text the admin has already written by hand.
 */
export function mergeAssistantDraft(
  body: NewsletterBody,
  draft: AssistantDraft,
): NewsletterBody {
  const byKind = new Map(draft.sections.map((section) => [section.kind, section]));

  const sections = body.sections.map((section) => {
    const suggestion = byKind.get(section.kind);
    if (!suggestion) return section;
    return {
      ...section,
      bodyEn: suggestion.bodyEn || section.bodyEn,
      bodyFr: suggestion.bodyFr || section.bodyFr,
      // A section the assistant filled becomes visible; one it left empty keeps
      // whatever the admin chose.
      enabled:
        suggestion.bodyEn || suggestion.bodyFr ? true : section.enabled,
    };
  });

  const result = newsletterBodySchema.safeParse({ sections });
  return result.success ? result.data : body;
}
