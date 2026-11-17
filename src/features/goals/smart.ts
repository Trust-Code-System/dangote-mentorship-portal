// Pure SMART logic for the Goal Coach (CLAUDE.md §7, experience-layer.md §1.7).
// No I/O: the deterministic SMART assessment runs even when the AI adapter is
// disabled, and the prompt builder + response parser are unit-tested so the
// AI-facing surface has a tested, defensive boundary. The coach only ever
// SUGGESTS — a human edits and the mentor approves (CLAUDE.md §0 rule 5).

export type SmartDimension = 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timeBound';

export interface GoalDraftFields {
  title: string;
  competency?: string | null;
  whyMatters?: string | null;
  currentLevel?: string | null;
  desiredLevel?: string | null;
  learningActivity?: string | null;
  successMeasure?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  settingDetails?: string | null;
}

export interface SmartAssessment {
  /** Dimensions that look present in the draft. */
  present: SmartDimension[];
  /** Dimensions that look missing or too thin. */
  missing: SmartDimension[];
  /** 0–100 readiness score (share of dimensions satisfied). */
  score: number;
}

function filled(value: string | null | undefined, min = 3): boolean {
  return typeof value === 'string' && value.trim().length >= min;
}

const ALL_DIMENSIONS: SmartDimension[] = [
  'specific',
  'measurable',
  'achievable',
  'relevant',
  'timeBound',
];

/**
 * Deterministic SMART check. Specific = a meaningful title + competency;
 * Measurable = a success measure; Achievable = a learning activity;
 * Relevant = why it matters; Time-bound = an end date (or a start+end window).
 */
export function assessSmart(fields: GoalDraftFields): SmartAssessment {
  const satisfied: Record<SmartDimension, boolean> = {
    specific: filled(fields.title, 6) && filled(fields.competency),
    measurable: filled(fields.successMeasure),
    achievable: filled(fields.learningActivity),
    relevant: filled(fields.whyMatters),
    timeBound: filled(fields.endDate),
  };

  const present = ALL_DIMENSIONS.filter((d) => satisfied[d]);
  const missing = ALL_DIMENSIONS.filter((d) => !satisfied[d]);
  const score = Math.round((present.length / ALL_DIMENSIONS.length) * 100);
  return { present, missing, score };
}

export interface CoachSuggestion {
  title: string;
  successMeasure: string;
  learningActivity: string;
  rationale: string;
}

/** Build the Goal Coach prompt. Kept pure so the exact instruction is testable. */
export function buildCoachPrompt(fields: GoalDraftFields, lang: 'EN' | 'FR'): string {
  const languageName = lang === 'FR' ? 'French' : 'English';
  const lines = [
    `Respond in ${languageName}.`,
    'A mentee has drafted a development goal. Rewrite it into a SMART goal',
    '(Specific, Measurable, Achievable, Results-oriented, Time-based).',
    'Return ONLY strict JSON of the shape:',
    '{"title": string, "successMeasure": string, "learningActivity": string, "rationale": string}',
    'Keep each field concise. "rationale" is one short sentence on what you improved.',
    'Do not invent facts the mentee did not provide; tighten and structure what is there.',
    '',
    'Draft goal:',
    `- Title: ${fields.title || '(none)'}`,
    `- Competency to develop: ${fields.competency || '(none)'}`,
    `- Why it matters: ${fields.whyMatters || '(none)'}`,
    `- Current level: ${fields.currentLevel || '(none)'}`,
    `- Desired level: ${fields.desiredLevel || '(none)'}`,
    `- Learning activity: ${fields.learningActivity || '(none)'}`,
    `- Success measure: ${fields.successMeasure || '(none)'}`,
    `- Start: ${fields.startDate || '(none)'} · End: ${fields.endDate || '(none)'}`,
  ];
  return lines.join('\n');
}

/**
 * Defensive parser for the coach's JSON. Returns null on anything unparseable or
 * shaped wrong, so the action can fall back to "no suggestion" rather than throw
 * across the RSC boundary. Tolerates models that wrap JSON in prose/fences.
 */
export function parseCoachResponse(raw: string): CoachSuggestion | null {
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
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  const title = str(obj.title);
  const successMeasure = str(obj.successMeasure);
  const learningActivity = str(obj.learningActivity);
  // A suggestion with no usable content is not a suggestion.
  if (!title && !successMeasure && !learningActivity) return null;

  return { title, successMeasure, learningActivity, rationale: str(obj.rationale) };
}
