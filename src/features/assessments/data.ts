import 'server-only';
import { cache } from 'react';
import { ReviewStatus, ReviewType, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { hasAnyRole, type SessionUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getMenteePairing, getMentorPairings } from '@/lib/pairings';
import {
  formTypesFor,
  isRecurringFormType,
  respondentRoleFor,
  rolesRequiredFor,
  type RecurringFormType,
} from './participants';
import { getActiveFormDefinition, type FormDefinitionDetail } from '@/features/forms/data';
import {
  evaluateAssessmentGate,
  lockDateFor,
  type AssessmentGate,
  type GateWindow,
} from './gate';

// Server reads for the recurring quarterly assessment (CLAUDE.md §5 Reviews).
// The gate runs on every authenticated page load, so every read here is a
// narrow, indexed query and the whole evaluation is request-cached.

/**
 * Whether this user can be gated at all.
 *
 * Mentors AND mentees are both held to the quarterly assessment, so both are
 * gateable. Admins never are — locking the people who administer the programme
 * out of it would be self-defeating, and an admin holds no participant
 * obligation (see participants.ts).
 */
export function isGatedRole(user: SessionUser): boolean {
  if (hasAnyRole(user, ADMIN_ROLES)) return false;
  return formTypesFor(user.roles).length > 0;
}

/**
 * The cohort a participant is assessed in: their accepted pairing's cohort,
 * falling back to a mentor/mentee role grant so someone not yet matched is
 * still tracked.
 *
 * Kept under the old name as well (below) because it is the mentee-specific
 * case several call sites still want.
 */
export const resolveParticipantCohortId = cache(
  async (userId: string): Promise<string | null> => {
    const menteePairing = await getMenteePairing(userId);
    if (menteePairing) return menteePairing.cohortId;

    const mentorPairings = await getMentorPairings(userId);
    if (mentorPairings[0]) return mentorPairings[0].cohortId;

    const grant = await prisma.userRole.findFirst({
      where: {
        userId,
        deletedAt: null,
        cohortId: { not: null },
        role: { name: { in: [RoleName.MENTEE, RoleName.MENTOR] } },
      },
      orderBy: { createdAt: 'desc' },
      select: { cohortId: true },
    });
    return grant?.cohortId ?? null;
  },
);

/** The cohort a mentee is assessed in. Mentee-specific by design. */
export const resolveMenteeCohortId = cache(async (userId: string): Promise<string | null> => {
  const pairing = await getMenteePairing(userId);
  if (pairing) return pairing.cohortId;

  const grant = await prisma.userRole.findFirst({
    where: {
      userId,
      deletedAt: null,
      cohortId: { not: null },
      role: { name: RoleName.MENTEE },
    },
    orderBy: { createdAt: 'desc' },
    select: { cohortId: true },
  });
  return grant?.cohortId ?? null;
});

/**
 * Windows a mentee is answerable for, with their own submission state.
 *
 * `gatesAccess: true` is the load-bearing filter: it is why the monthly meeting
 * form can never lock anyone out, no matter how many are outstanding. A
 * non-gating form is chased with reminders (lib/notifications/cron.ts) instead.
 */
async function loadGateWindows(
  cohortId: string,
  userId: string,
  formTypes: RecurringFormType[],
): Promise<GateWindow[]> {
  const windows = await prisma.assessmentWindow.findMany({
    where: {
      cohortId,
      formType: { in: formTypes },
      isActive: true,
      gatesAccess: true,
      deletedAt: null,
    },
    orderBy: { dueAt: 'asc' },
    select: {
      id: true,
      label: true,
      opensAt: true,
      dueAt: true,
      graceDays: true,
      responses: {
        where: { respondentId: userId, status: ReviewStatus.SUBMITTED, deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });

  return windows.map((w) => ({
    id: w.id,
    label: w.label,
    opensAt: w.opensAt,
    dueAt: w.dueAt,
    graceDays: w.graceDays,
    submitted: w.responses.length > 0,
  }));
}

const CLEAR: AssessmentGate = {
  state: 'CLEAR',
  locked: false,
  window: null,
  lockAt: null,
  daysUntilLock: null,
};

/**
 * Evaluate the gate for the current user. Request-cached on the user id so the
 * layout, the banner and any action guard in one render share a single query.
 */
export const getAssessmentGate = cache(async (user: SessionUser): Promise<AssessmentGate> => {
  if (!isGatedRole(user)) return CLEAR;

  // Only the forms this user actually owes can gate them — a mentor is never
  // held to the mentee-only monthly form.
  const formTypes = formTypesFor(user.roles);
  if (formTypes.length === 0) return CLEAR;

  const cohortId = await resolveParticipantCohortId(user.id);
  if (!cohortId) return CLEAR;

  const windows = await loadGateWindows(cohortId, user.id, formTypes);
  return evaluateAssessmentGate(windows, new Date());
});

export interface AssessmentHistoryEntry {
  windowId: string;
  label: string;
  dueAt: Date;
  submittedAt: Date | null;
}

export interface AssessmentAssignment {
  cohortId: string;
  /** Which question set this user gets: MENTOR or MENTEE. */
  respondentRole: RoleName;
  /** Gate state — always CLEAR for a non-gating form like the monthly one. */
  gate: AssessmentGate;
  /** The window this mentee should fill now for this form type, if any. */
  current: GateWindow | null;
  /** The active form of this type for mentees in this cohort, or null. */
  form: FormDefinitionDetail | null;
  /** Past + current windows with this mentee's submission state, newest first. */
  history: AssessmentHistoryEntry[];
}

/**
 * Everything a recurring-form page needs, for one form type. Null when the user
 * isn't a mentee in a cohort.
 *
 * For QUARTERLY the outstanding window comes from the gate (which is what locks
 * the portal). For MONTHLY there is no gate, so the outstanding window is
 * computed the same way but purely for display.
 */
export async function getAssessmentAssignment(
  user: SessionUser,
  formType: RecurringFormType = ReviewType.QUARTERLY,
): Promise<AssessmentAssignment | null> {
  // The role they answer as also selects the question set: the quarterly
  // assessment has a distinct mentor and mentee form.
  const respondentRole = respondentRoleFor(user.roles, formType);
  if (!respondentRole) return null;

  const cohortId = await resolveParticipantCohortId(user.id);
  if (!cohortId) return null;

  const [gate, form, windows] = await Promise.all([
    getAssessmentGate(user),
    getActiveFormDefinition(cohortId, formType, respondentRole),
    prisma.assessmentWindow.findMany({
      where: {
        cohortId,
        formType,
        isActive: true,
        deletedAt: null,
        opensAt: { lte: new Date() },
      },
      orderBy: { dueAt: 'desc' },
      select: {
        id: true,
        label: true,
        opensAt: true,
        dueAt: true,
        graceDays: true,
        responses: {
          where: { respondentId: user.id, status: ReviewStatus.SUBMITTED, deletedAt: null },
          orderBy: { submittedAt: 'desc' },
          select: { submittedAt: true },
          take: 1,
        },
      },
    }),
  ]);

  // For a gating form the gate has already picked the outstanding window (and
  // it is the same computation); for a non-gating form nothing else does, so
  // derive it here with the shared pure function.
  const outstanding = evaluateAssessmentGate(
    windows.map((w) => ({
      id: w.id,
      label: w.label,
      opensAt: w.opensAt,
      dueAt: w.dueAt,
      graceDays: w.graceDays,
      submitted: w.responses.length > 0,
    })),
    new Date(),
  ).window;

  return {
    cohortId,
    respondentRole,
    gate,
    current: outstanding,
    form,
    history: windows.map((w) => ({
      windowId: w.id,
      label: w.label,
      dueAt: w.dueAt,
      submittedAt: w.responses[0]?.submittedAt ?? null,
    })),
  };
}

/** A mentee's saved answers for one window, for pre-filling an update. */
export async function getWindowSubmission(
  userId: string,
  windowId: string,
): Promise<{ id: string; submittedAt: Date | null; answers: Record<string, unknown> } | null> {
  const response = await prisma.formResponse.findFirst({
    where: {
      assessmentWindowId: windowId,
      respondentId: userId,
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
    },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, submittedAt: true, answers: true },
  });
  if (!response) return null;
  return {
    id: response.id,
    submittedAt: response.submittedAt,
    answers: (response.answers as Record<string, unknown>) ?? {},
  };
}

// ── Admin reads ─────────────────────────────────────────────────────────────

export interface AssessmentWindowSummary {
  id: string;
  sequence: number;
  label: string;
  opensAt: Date;
  dueAt: Date;
  graceDays: number;
  isActive: boolean;
  lockAt: Date;
  /** True when this window has already opened (computed server-side). */
  hasOpened: boolean;
  submittedCount: number;
}

export interface AssessmentOverview {
  cohortId: string;
  cohortName: string;
  formType: RecurringFormType;
  /** False for the monthly meeting form — nobody is locked out by it. */
  gatesAccess: boolean;
  intervalMonths: number;
  graceDays: number;
  startDate: Date | null;
  endDate: Date | null;
  /** Mentees in the cohort — the denominator for completion. */
  menteeCount: number;
  formPublished: boolean;
  windows: AssessmentWindowSummary[];
}

/**
 * User ids in a cohort who owe `formType` — the denominator for completion.
 *
 * Derived from participants.ts rather than hardcoded, so the admin's numbers
 * and the gate can never disagree about who was supposed to submit: the
 * quarterly assessment counts mentors and mentees, the monthly form mentees.
 */
export async function listCohortRespondentIds(
  cohortId: string,
  formType: RecurringFormType,
): Promise<string[]> {
  const grants = await prisma.userRole.findMany({
    where: {
      cohortId,
      deletedAt: null,
      role: { name: { in: rolesRequiredFor(formType) } },
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  });
  return Array.from(new Set(grants.map((g) => g.userId)));
}

/** Mentee user ids in a cohort. Kept for the mentee-specific call sites. */
export async function listCohortMenteeIds(cohortId: string): Promise<string[]> {
  return listCohortRespondentIds(cohortId, ReviewType.MONTHLY);
}

export async function getAssessmentOverview(
  cohortId: string,
  formType: RecurringFormType = ReviewType.QUARTERLY,
): Promise<AssessmentOverview | null> {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, deletedAt: null },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      assessmentIntervalMonths: true,
      assessmentGraceDays: true,
    },
  });
  if (!cohort) return null;

  const [windows, respondentIds, forms] = await Promise.all([
    prisma.assessmentWindow.findMany({
      where: { cohortId, formType, deletedAt: null },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        sequence: true,
        label: true,
        opensAt: true,
        dueAt: true,
        graceDays: true,
        isActive: true,
      },
    }),
    listCohortRespondentIds(cohortId, formType),
    // "Is a form published?" means: is there one for every role that owes it.
    Promise.all(
      rolesRequiredFor(formType).map((role) =>
        getActiveFormDefinition(cohortId, formType, role),
      ),
    ),
  ]);

  // Submitted counts per window in one grouped query (rather than a filtered
  // relation count, which Prisma still gates behind a preview flag).
  const counts = await prisma.formResponse.groupBy({
    by: ['assessmentWindowId'],
    where: {
      assessmentWindowId: { in: windows.map((w) => w.id) },
      respondentId: { in: respondentIds },
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
    },
    _count: { _all: true },
  });
  const submittedBy = new Map(counts.map((c) => [c.assessmentWindowId, c._count._all]));
  const now = Date.now();

  return {
    cohortId: cohort.id,
    cohortName: cohort.name,
    formType,
    gatesAccess: formType !== ReviewType.MONTHLY,
    intervalMonths: cohort.assessmentIntervalMonths,
    graceDays: cohort.assessmentGraceDays,
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    menteeCount: respondentIds.length,
    // Every required role must have a live form, or somebody cannot submit.
    formPublished: forms.length > 0 && forms.every((f) => f !== null),
    windows: windows.map((w) => ({
      id: w.id,
      sequence: w.sequence,
      label: w.label,
      opensAt: w.opensAt,
      dueAt: w.dueAt,
      graceDays: w.graceDays,
      isActive: w.isActive,
      lockAt: lockDateFor(w),
      hasOpened: w.opensAt.getTime() <= now,
      submittedCount: submittedBy.get(w.id) ?? 0,
    })),
  };
}

export interface MenteeAssessmentRow {
  userId: string;
  name: string | null;
  email: string;
  submittedAt: Date | null;
  state: AssessmentGate['state'];
}

/**
 * Per-mentee completion for one window — the admin's "who is about to be locked
 * out" list. Metadata only: answers are never included here.
 */
export async function listWindowCompletion(
  cohortId: string,
  windowId: string,
): Promise<MenteeAssessmentRow[]> {
  const window = await prisma.assessmentWindow.findFirst({
    where: { id: windowId, cohortId, deletedAt: null },
    select: {
      id: true,
      label: true,
      opensAt: true,
      dueAt: true,
      graceDays: true,
      formType: true,
    },
  });
  if (!window) return [];
  if (!isRecurringFormType(window.formType)) return [];

  const menteeIds = await listCohortRespondentIds(cohortId, window.formType);
  if (menteeIds.length === 0) return [];

  const [users, responses] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: menteeIds } },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true },
    }),
    prisma.formResponse.findMany({
      where: {
        assessmentWindowId: windowId,
        respondentId: { in: menteeIds },
        status: ReviewStatus.SUBMITTED,
        deletedAt: null,
      },
      select: { respondentId: true, submittedAt: true },
    }),
  ]);

  const submittedAtBy = new Map(responses.map((r) => [r.respondentId, r.submittedAt]));
  const now = new Date();

  return users.map((user) => {
    const submittedAt = submittedAtBy.get(user.id) ?? null;
    const gate = evaluateAssessmentGate(
      [{ ...window, submitted: submittedAt !== null }],
      now,
    );
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      submittedAt,
      state: gate.state,
    };
  });
}
