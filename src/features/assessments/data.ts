import 'server-only';
import { cache } from 'react';
import { ReviewStatus, ReviewType, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { hasAnyRole, type SessionUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getMenteePairing } from '@/lib/pairings';
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
 * Only mentees are gated. Admins are never gated — locking the people who
 * administer the programme out of it would be self-defeating — and a mentor is
 * assessed through the mid-term/final reviews instead.
 */
export function isGatedRole(user: SessionUser): boolean {
  if (hasAnyRole(user, ADMIN_ROLES)) return false;
  return user.roles.includes(RoleName.MENTEE);
}

/**
 * The cohort a mentee is assessed in: their accepted pairing's cohort, falling
 * back to their MENTEE role grant so a not-yet-matched mentee is still tracked.
 */
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

/** Windows a mentee is answerable for, with their own submission state. */
async function loadGateWindows(cohortId: string, userId: string): Promise<GateWindow[]> {
  const windows = await prisma.assessmentWindow.findMany({
    where: { cohortId, isActive: true, deletedAt: null },
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

  const cohortId = await resolveMenteeCohortId(user.id);
  if (!cohortId) return CLEAR;

  const windows = await loadGateWindows(cohortId, user.id);
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
  gate: AssessmentGate;
  /** The active QUARTERLY form for mentees in this cohort, or null if unpublished. */
  form: FormDefinitionDetail | null;
  /** Past + current windows with this mentee's submission state, newest first. */
  history: AssessmentHistoryEntry[];
}

/** Everything the /assessment page needs. Null when the user isn't a mentee in a cohort. */
export async function getAssessmentAssignment(
  user: SessionUser,
): Promise<AssessmentAssignment | null> {
  if (!user.roles.includes(RoleName.MENTEE)) return null;

  const cohortId = await resolveMenteeCohortId(user.id);
  if (!cohortId) return null;

  const [gate, form, windows] = await Promise.all([
    getAssessmentGate(user),
    getActiveFormDefinition(cohortId, ReviewType.QUARTERLY, RoleName.MENTEE),
    prisma.assessmentWindow.findMany({
      where: { cohortId, isActive: true, deletedAt: null, opensAt: { lte: new Date() } },
      orderBy: { dueAt: 'desc' },
      select: {
        id: true,
        label: true,
        dueAt: true,
        responses: {
          where: { respondentId: user.id, status: ReviewStatus.SUBMITTED, deletedAt: null },
          orderBy: { submittedAt: 'desc' },
          select: { submittedAt: true },
          take: 1,
        },
      },
    }),
  ]);

  return {
    cohortId,
    gate,
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
  intervalMonths: number;
  graceDays: number;
  startDate: Date | null;
  endDate: Date | null;
  /** Mentees in the cohort — the denominator for completion. */
  menteeCount: number;
  formPublished: boolean;
  windows: AssessmentWindowSummary[];
}

/** Mentee user ids in a cohort (accepted pairings plus cohort role grants). */
export async function listCohortMenteeIds(cohortId: string): Promise<string[]> {
  const grants = await prisma.userRole.findMany({
    where: {
      cohortId,
      deletedAt: null,
      role: { name: RoleName.MENTEE },
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  });
  return Array.from(new Set(grants.map((g) => g.userId)));
}

export async function getAssessmentOverview(cohortId: string): Promise<AssessmentOverview | null> {
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

  const [windows, menteeIds, form] = await Promise.all([
    prisma.assessmentWindow.findMany({
      where: { cohortId, deletedAt: null },
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
    listCohortMenteeIds(cohortId),
    getActiveFormDefinition(cohortId, ReviewType.QUARTERLY, RoleName.MENTEE),
  ]);

  // Submitted counts per window in one grouped query (rather than a filtered
  // relation count, which Prisma still gates behind a preview flag).
  const counts = await prisma.formResponse.groupBy({
    by: ['assessmentWindowId'],
    where: {
      assessmentWindowId: { in: windows.map((w) => w.id) },
      respondentId: { in: menteeIds },
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
    intervalMonths: cohort.assessmentIntervalMonths,
    graceDays: cohort.assessmentGraceDays,
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    menteeCount: menteeIds.length,
    formPublished: form !== null,
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
    select: { id: true, label: true, opensAt: true, dueAt: true, graceDays: true },
  });
  if (!window) return [];

  const menteeIds = await listCohortMenteeIds(cohortId);
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
