/**
 * The intake validation engine (CLAUDE.md §11). PURE: no I/O — fully
 * unit-testable with golden cases. Imported data is untrusted (§14).
 *
 * Pipeline per row: normalize headers → clean values → emit plain-language,
 * row-level findings the admin fixes or accepts on the review screen.
 * Findings are deterministic; the AI assistant may rephrase/summarize them,
 * but it never decides what is or isn't a problem.
 */

export type TargetRole = 'MENTOR' | 'MENTEE';

export type FindingSeverity = 'ERROR' | 'WARNING';

export type FindingCode =
  | 'MISSING_NAME'
  | 'MISSING_EMAIL'
  | 'INVALID_EMAIL'
  | 'MISSING_LANGUAGE'
  | 'INVALID_LANGUAGE'
  | 'MISSING_DEPARTMENT'
  | 'MISSING_ROLE'
  | 'MISSING_COMPETENCY'
  | 'EXPERIENCE_NO_COMPETENCY'
  | 'EMPTY_EXPERIENCE'
  | 'MISSING_CAREER_GOAL'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_EXISTING'
  | 'INCOMPLETE_RESPONSE';

export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  field: string;
  message: string;
}

/** Canonical row shape after header normalization and cleaning. */
export interface CleanRow {
  fullName: string;
  email: string;
  phone: string;
  language: 'EN' | 'FR' | '';
  department: string;
  jobTitle: string;
  location: string;
  yearsExperience: number | null;
  competencies: string[];
  careerGoals: string;
  whyText: string;
  personality: string;
  availability: string;
  maxMentees: number | null;
}

// ── Header normalization ─────────────────────────────────────────────────────
// Sheets arrive from Excel, Google Forms, etc. with many header spellings,
// in English or French. Map them all onto canonical fields.

const HEADER_ALIASES: Record<keyof CleanRow, string[]> = {
  fullName: ['full name', 'name', 'nom', 'nom complet', 'fullname', 'participant name'],
  email: ['email', 'e-mail', 'email address', 'mail', 'courriel', 'adresse e-mail'],
  phone: ['phone', 'phone number', 'telephone', 'téléphone', 'mobile'],
  language: ['language', 'preferred language', 'langue', 'langue préférée', 'lang'],
  department: ['department', 'dept', 'département', 'business unit', 'unit'],
  jobTitle: ['job title', 'title', 'role', 'position', 'poste', 'fonction', 'current role'],
  location: ['location', 'site', 'lieu', 'city', 'ville', 'country'],
  yearsExperience: [
    'years of experience', 'experience', 'years experience', 'yrs experience',
    'années d’expérience', 'annees d’experience', 'experience (years)',
  ],
  competencies: [
    'competencies', 'competency', 'competences', 'compétences', 'skills',
    'general competencies', 'technical competencies', 'competency areas',
    'competencies to strengthen', 'strongest competencies',
  ],
  careerGoals: ['career goals', 'career goal', 'goals', 'objectifs de carrière', 'objectifs'],
  whyText: [
    'why', 'why mentor', 'why do you want to mentor', 'why do you want a mentor',
    'motivation', 'pourquoi',
  ],
  personality: ['personality', 'personnalité', 'personality type'],
  availability: ['availability', 'disponibilité', 'available times'],
  maxMentees: ['max mentees', 'capacity', 'mentee capacity', 'nombre de mentorés'],
};

function canonicalKey(header: string): keyof CleanRow | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof CleanRow, string[]]
  >) {
    if (aliases.includes(h)) return key;
  }
  return null;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseYears(value: unknown): number | null {
  const s = asString(value);
  if (!s) return null;
  const match = /(\d+(?:\.\d+)?)/.exec(s);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseLanguage(value: unknown): 'EN' | 'FR' | '' {
  const s = asString(value).toLowerCase();
  if (['en', 'eng', 'english', 'anglais'].includes(s)) return 'EN';
  if (['fr', 'fra', 'french', 'français', 'francais'].includes(s)) return 'FR';
  return '';
}

function parseCompetencies(value: unknown): string[] {
  const s = asString(value);
  if (!s) return [];
  return s
    .split(/[;,/|]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Normalize one raw sheet row (arbitrary headers) into the canonical shape. */
export function cleanRow(raw: Record<string, unknown>): CleanRow {
  const out: CleanRow = {
    fullName: '',
    email: '',
    phone: '',
    language: '',
    department: '',
    jobTitle: '',
    location: '',
    yearsExperience: null,
    competencies: [],
    careerGoals: '',
    whyText: '',
    personality: '',
    availability: '',
    maxMentees: null,
  };

  for (const [header, value] of Object.entries(raw)) {
    const key = canonicalKey(header);
    if (!key) continue;
    switch (key) {
      case 'yearsExperience':
        out.yearsExperience = parseYears(value);
        break;
      case 'language':
        out.language = parseLanguage(value);
        break;
      case 'competencies':
        // Multiple competency columns may map here; merge them.
        out.competencies = [...out.competencies, ...parseCompetencies(value)];
        break;
      case 'maxMentees': {
        const n = parseYears(value);
        out.maxMentees = n === null ? null : Math.trunc(n);
        break;
      }
      default:
        out[key] = asString(value);
    }
  }

  out.email = out.email.toLowerCase();
  return out;
}

// ── Validation ───────────────────────────────────────────────────────────────

// Pragmatic email shape check; deliverability isn't knowable at import time.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ValidationContext {
  targetRole: TargetRole;
  /** Lower-cased emails already present in the cohort (existing profiles). */
  existingEmails: ReadonlySet<string>;
  /** Lower-cased emails seen earlier in this same file. */
  seenEmailsInFile: ReadonlySet<string>;
  /**
   * The one language this cohort runs in, or null when it runs in several.
   *
   * A single-language cohort has nothing to ask: a row with no language column
   * can only be that language, so it is inferred instead of raising a blocking
   * error the admin can only resolve by typing the same answer 300 times.
   * Omitted (or null) keeps the original behaviour and still flags it.
   */
  soleLanguage?: 'EN' | 'FR' | null;
}

/**
 * Validate a cleaned row. Messages are written exactly the way the spec wants
 * them surfaced: plain language an admin can act on (§11).
 */
export function validateRow(row: CleanRow, ctx: ValidationContext): Finding[] {
  const findings: Finding[] = [];
  const who = ctx.targetRole === 'MENTOR' ? 'mentor' : 'mentee';
  const name = row.fullName || 'This participant';

  if (!row.fullName) {
    findings.push({
      code: 'MISSING_NAME',
      severity: 'ERROR',
      field: 'fullName',
      message: 'This row has no name.',
    });
  }

  if (!row.email) {
    findings.push({
      code: 'MISSING_EMAIL',
      severity: 'ERROR',
      field: 'email',
      message: `${name} has no email address.`,
    });
  } else if (!EMAIL_RE.test(row.email)) {
    findings.push({
      code: 'INVALID_EMAIL',
      severity: 'ERROR',
      field: 'email',
      message: `"${row.email}" does not look like a valid email address.`,
    });
  } else {
    if (ctx.seenEmailsInFile.has(row.email)) {
      findings.push({
        code: 'DUPLICATE_IN_FILE',
        severity: 'ERROR',
        field: 'email',
        message: `${name} appears more than once in this file (${row.email}).`,
      });
    }
    if (ctx.existingEmails.has(row.email)) {
      findings.push({
        code: 'DUPLICATE_EXISTING',
        severity: 'WARNING',
        field: 'email',
        message: `${name} already exists in this cohort (${row.email}).`,
      });
    }
  }

  // Only a genuinely ambiguous language is a problem. `resolveRowLanguage`
  // below is the matching inference the commit uses, so the flag and the write
  // can never disagree.
  if (!row.language && !ctx.soleLanguage) {
    findings.push({
      code: 'MISSING_LANGUAGE',
      severity: 'ERROR',
      field: 'language',
      message: `This ${who} has no language selected.`,
    });
  }

  if (!row.department) {
    findings.push({
      code: 'MISSING_DEPARTMENT',
      severity: 'WARNING',
      field: 'department',
      message: `${name} has no department.`,
    });
  }

  if (!row.jobTitle) {
    findings.push({
      code: 'MISSING_ROLE',
      severity: 'WARNING',
      field: 'jobTitle',
      message: `${name} has no current role/job title.`,
    });
  }

  if (row.competencies.length === 0) {
    if (ctx.targetRole === 'MENTOR' && row.yearsExperience !== null && row.yearsExperience >= 10) {
      findings.push({
        code: 'EXPERIENCE_NO_COMPETENCY',
        severity: 'WARNING',
        field: 'competencies',
        message: `${row.yearsExperience} years' experience but no competency area selected.`,
      });
    } else {
      findings.push({
        code: 'MISSING_COMPETENCY',
        severity: 'WARNING',
        field: 'competencies',
        message: `This ${who} has no competencies listed.`,
      });
    }
  }

  if (ctx.targetRole === 'MENTOR' && row.yearsExperience === null) {
    findings.push({
      code: 'EMPTY_EXPERIENCE',
      severity: 'WARNING',
      field: 'yearsExperience',
      message: `${name} has no years of experience recorded.`,
    });
  }

  if (ctx.targetRole === 'MENTEE' && !row.careerGoals) {
    findings.push({
      code: 'MISSING_CAREER_GOAL',
      severity: 'WARNING',
      field: 'careerGoals',
      message: 'This mentee has no career goal.',
    });
  }

  // Mostly-empty rows: flag as an incomplete response. Counts what the file
  // actually said, so an inferred language never makes a blank row look answered.
  const filled = [
    row.fullName, row.email, row.language, row.department, row.jobTitle,
    row.careerGoals, row.whyText,
  ].filter((v) => v !== '').length;
  if (filled <= 2) {
    findings.push({
      code: 'INCOMPLETE_RESPONSE',
      severity: 'ERROR',
      field: '*',
      message: 'This response is mostly empty — it may be an incomplete submission.',
    });
  }

  return findings;
}

/**
 * The language to record for a row: what the file said, else the cohort's sole
 * language, else English.
 *
 * English is the last resort only because the row got past validation, which
 * blocks a missing language whenever the cohort is bilingual — so this arm is
 * reached for a single-language cohort or a row an admin explicitly accepted.
 */
export function resolveRowLanguage(
  rowLanguage: 'EN' | 'FR' | '',
  soleLanguage?: 'EN' | 'FR' | null,
): 'EN' | 'FR' {
  if (rowLanguage) return rowLanguage;
  return soleLanguage ?? 'EN';
}

/** ERRORs block committing a row; WARNINGs can be accepted as-is. */
export function hasBlockingErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'ERROR');
}

/**
 * Validate a whole file: threads the duplicate-tracking context through rows
 * in order, so later duplicates are flagged against earlier rows.
 */
export function validateRows(
  rawRows: Array<Record<string, unknown>>,
  opts: {
    targetRole: TargetRole;
    existingEmails: ReadonlySet<string>;
    /** See ValidationContext.soleLanguage. */
    soleLanguage?: 'EN' | 'FR' | null;
  },
): Array<{ clean: CleanRow; findings: Finding[] }> {
  const seen = new Set<string>();
  const results: Array<{ clean: CleanRow; findings: Finding[] }> = [];

  for (const raw of rawRows) {
    const clean = cleanRow(raw);
    const findings = validateRow(clean, {
      targetRole: opts.targetRole,
      existingEmails: opts.existingEmails,
      seenEmailsInFile: seen,
      soleLanguage: opts.soleLanguage,
    });
    if (clean.email && EMAIL_RE.test(clean.email)) seen.add(clean.email);
    results.push({ clean, findings });
  }

  return results;
}
