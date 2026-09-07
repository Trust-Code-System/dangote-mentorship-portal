import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────
// Newsletter content + schedule (CLAUDE.md §10 "Weekly newsletters").
//
// The admin sends twice a week, so the composer is section-based rather than a
// blank rich-text box: the same shape every time, pre-arranged, bilingual, and
// simple enough that the Newsletter Assistant can fill it from portal data and
// the admin only has to review it.
//
// Sending is always a human action (§0 rule 5 / §16). The schedule prepares
// drafts; it never sends.
// ──────────────────────────────────────────────────────────────────────────

export const NEWSLETTER_SECTION_KINDS = [
  /** Opening note from the programme team. */
  'intro',
  /** A few short lines — what happened this week. */
  'highlights',
  /** Numbers worth sharing (goals approved, sessions logged, …). */
  'numbers',
  /** Dates coming up: clinics, assessment deadlines, meetings. */
  'dates',
  /** One pair's or person's story. */
  'spotlight',
  /** A closing call to action. */
  'callToAction',
] as const;

export type NewsletterSectionKind = (typeof NEWSLETTER_SECTION_KINDS)[number];

/**
 * Bilingual section. Both languages are stored; the send picks the recipient's
 * own language and falls back to the other rather than dropping the section —
 * an untranslated section is better than a missing one, and the admin sees
 * which are missing in the composer.
 */
export const newsletterSectionSchema = z.object({
  kind: z.enum(NEWSLETTER_SECTION_KINDS),
  headingEn: z.string().trim().max(160).default(''),
  headingFr: z.string().trim().max(160).default(''),
  /** Body text. One item per line for list-shaped sections. */
  bodyEn: z.string().trim().max(4000).default(''),
  bodyFr: z.string().trim().max(4000).default(''),
  /** Hidden sections stay in the draft but are not sent. */
  enabled: z.boolean().default(true),
});

export type NewsletterSection = z.infer<typeof newsletterSectionSchema>;

export const newsletterBodySchema = z.object({
  sections: z.array(newsletterSectionSchema).min(1).max(12),
});

export type NewsletterBody = z.infer<typeof newsletterBodySchema>;

export function parseNewsletterBody(value: unknown): NewsletterBody | null {
  const result = newsletterBodySchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Default headings for a fresh draft, so the composer is never a blank page. */
const DEFAULT_HEADINGS: Record<
  NewsletterSectionKind,
  { en: string; fr: string }
> = {
  intro: { en: 'This week in the programme', fr: 'Cette semaine dans le programme' },
  highlights: { en: 'Highlights', fr: 'Points forts' },
  numbers: { en: 'By the numbers', fr: 'En chiffres' },
  dates: { en: 'Dates to remember', fr: 'Dates à retenir' },
  spotlight: { en: 'Spotlight', fr: 'Coup de projecteur' },
  callToAction: { en: 'What to do next', fr: 'Prochaine étape' },
};

/** The pre-arranged section order every issue uses. */
export function emptyNewsletterBody(): NewsletterBody {
  return {
    sections: NEWSLETTER_SECTION_KINDS.map((kind) => ({
      kind,
      headingEn: DEFAULT_HEADINGS[kind].en,
      headingFr: DEFAULT_HEADINGS[kind].fr,
      bodyEn: '',
      bodyFr: '',
      // Spotlight starts off: it needs a real story, not filler.
      enabled: kind !== 'spotlight',
    })),
  };
}

export function defaultHeadingFor(
  kind: NewsletterSectionKind,
  lang: 'EN' | 'FR',
): string {
  return lang === 'FR' ? DEFAULT_HEADINGS[kind].fr : DEFAULT_HEADINGS[kind].en;
}

/** Sections with something to actually say in at least one language. */
export function sendableSections(body: NewsletterBody): NewsletterSection[] {
  return body.sections.filter(
    (section) => section.enabled && (section.bodyEn.trim() !== '' || section.bodyFr.trim() !== ''),
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

/** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const scheduleSchema = z.object({
  cohortId: z.string().cuid(),
  enabled: z.coerce.boolean().default(false),
  /** Posted as repeated `sendDays` checkbox values. */
  sendDays: z.array(z.coerce.number().int().min(1).max(7)).max(7),
  sendHour: z.coerce.number().int().min(0).max(23),
  timezone: z.string().trim().min(1).max(64),
  autoDraft: z.coerce.boolean().default(true),
});

/**
 * ISO weekday (1–7) for a date in a named timezone.
 *
 * Pure: takes the instant and the zone, uses Intl rather than the host's local
 * clock, so a server in UTC and a server in Lagos agree on "is today a
 * newsletter day in Africa/Lagos?".
 */
export function isoWeekdayIn(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short' }).format(date);
  const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);
  // An unknown weekday string would mean a broken Intl; fall back to Monday
  // rather than throwing inside a cron job.
  return index === -1 ? 1 : index + 1;
}

/** Hour of day (0–23) for a date in a named timezone. */
export function hourIn(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed % 24 : 0;
}

/** Calendar date in a named timezone, as `yyyy-mm-dd` — the de-dupe key. */
export function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface DraftDueInput {
  enabled: boolean;
  sendDays: number[];
  sendHour: number;
  timezone: string;
  /** When the schedule last prepared a draft. */
  lastDraftedFor: Date | null;
  now: Date;
}

/**
 * Should the schedule prepare a draft right now?
 *
 * The rule is "one draft per scheduled day, never two", expressed against the
 * most recent scheduled day whose send hour has already passed:
 *
 *   - never drafted before → due only if that occurrence is TODAY. A schedule
 *     that has just been switched on does not back-fill last week.
 *   - drafted before → due if the latest occurrence is newer than the last
 *     draft. This catches up a missed day, which matters because the scheduler
 *     may only run once a day: without it, a schedule whose send hour falls
 *     after the daily run would never produce a draft at all.
 *
 * Idempotent either way — drafting stamps `lastDraftedFor` at that occurrence's
 * day, so a second run the same day (or an hourly cron) does nothing.
 */
export function isDraftDue(input: DraftDueInput): boolean {
  if (!input.enabled) return false;
  if (input.sendDays.length === 0) return false;

  const occurrence = latestDueOccurrence(input);
  if (occurrence === null) return false;

  const today = localDateKey(input.now, input.timezone);

  // A brand-new schedule only acts on today, so switching it on cannot
  // immediately produce a draft dated to a day nobody was expecting one.
  if (!input.lastDraftedFor) return occurrence === today;

  // yyyy-mm-dd keys compare correctly as strings.
  return occurrence > localDateKey(input.lastDraftedFor, input.timezone);
}

/** How far back to look for a missed scheduled day. */
const CATCH_UP_DAYS = 8;

/**
 * Local date (`yyyy-mm-dd`) of the most recent scheduled day whose send hour has
 * passed, or null if there is none within the catch-up window.
 *
 * Works in local date keys rather than instants so no timezone arithmetic is
 * needed beyond `Intl` — which keeps this pure and testable, and correct across
 * DST without a date library.
 */
export function latestDueOccurrence(
  input: Omit<DraftDueInput, 'enabled' | 'lastDraftedFor'>,
): string | null {
  const todayKey = localDateKey(input.now, input.timezone);

  for (let daysBack = 0; daysBack < CATCH_UP_DAYS; daysBack += 1) {
    const candidate = new Date(input.now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const weekday = isoWeekdayIn(candidate, input.timezone);
    if (!input.sendDays.includes(weekday)) continue;

    const candidateKey = localDateKey(candidate, input.timezone);
    // Today counts only once its send hour has arrived; an earlier day is
    // wholly in the past, so its hour necessarily has.
    if (candidateKey === todayKey && hourIn(input.now, input.timezone) < input.sendHour) {
      continue;
    }
    return candidateKey;
  }

  return null;
}

/** Weekday label for the schedule UI. */
export function weekdayLabel(weekday: number, locale: string): string {
  // 2026-01-05 is a Monday, so +(weekday-1) days lands on the right day.
  const date = new Date(Date.UTC(2026, 0, 4 + weekday));
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date);
}

// ── Boundary schemas ────────────────────────────────────────────────────────

const bodyJson = z
  .string()
  .trim()
  .min(1, 'The newsletter is empty.')
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The newsletter content was malformed.' });
      return z.NEVER;
    }
  })
  .pipe(newsletterBodySchema);

export const createNewsletterSchema = z.object({
  cohortId: z.string().cuid(),
  title: z.string().trim().min(2, 'Give this issue a name.').max(200),
});

export const newsletterIdSchema = z.object({ newsletterId: z.string().cuid() });

export const saveNewsletterSchema = z.object({
  newsletterId: z.string().cuid(),
  title: z.string().trim().min(2, 'Give this issue a name.').max(200),
  subjectEn: z.string().trim().min(2, 'An English subject line is required.').max(200),
  subjectFr: z.string().trim().min(2, 'A French subject line is required.').max(200),
  body: bodyJson,
});

export const scheduleSendSchema = z.object({
  newsletterId: z.string().cuid(),
  /** Empty = send as soon as the dispatcher next runs. */
  sendAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value) : null))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), 'Enter a valid date.'),
});
