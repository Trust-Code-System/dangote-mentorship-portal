import 'server-only';
import {
  GoalStatus,
  MatchStatus,
  ReviewStatus,
  ReviewType,
  RoleName,
  TrainingStatus,
  type Language,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  adminCohortFilter,
  canAccessCohort,
  hasAnyRole,
  type SessionUser,
} from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { createCertificateId, type CertificateRole } from './id';

export type { CertificateRole } from './id';
export type CertificateLanguage = 'EN' | 'FR';

export interface CertificateEligibility {
  trainingCompleted: boolean;
  goalApproved: boolean;
  midtermSubmitted: boolean;
  finalSubmitted: boolean;
}

export interface CertificateData {
  matchId: string;
  cohortId: string;
  recipientId: string;
  recipientName: string;
  recipientLocale: CertificateLanguage;
  role: CertificateRole;
  programmeName: string;
  cohortName: string;
  counterpartName: string | null;
  earned: boolean;
  eligibility: CertificateEligibility;
  /** ISO yyyy-mm-dd. Completion date when earned, otherwise preview date. */
  issuedDate: string;
  certificateId: string;
}

type CertificateMatch = Awaited<ReturnType<typeof loadMatch>>;

function asCertificateLanguage(locale: Language | string): CertificateLanguage {
  return String(locale).toUpperCase() === 'FR' ? 'FR' : 'EN';
}

function latestDate(dates: Array<Date | null | undefined>): Date {
  const valid = dates.filter((date): date is Date => date instanceof Date);
  return valid.length > 0
    ? new Date(Math.max(...valid.map((date) => date.getTime())))
    : new Date();
}

async function loadMatch(matchId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, status: MatchStatus.ACCEPTED, deletedAt: null },
    select: {
      id: true,
      cohortId: true,
      acceptedAt: true,
      mentorId: true,
      menteeId: true,
      mentor: { select: { id: true, name: true, locale: true } },
      mentee: { select: { id: true, name: true, locale: true } },
      cohort: {
        select: {
          id: true,
          name: true,
          endDate: true,
          programme: { select: { name: true } },
        },
      },
    },
  });
}

async function buildCertificateData(
  match: NonNullable<CertificateMatch>,
  role: CertificateRole,
): Promise<CertificateData> {
  const recipient = role === 'mentee' ? match.mentee : match.mentor;
  const counterpart = role === 'mentee' ? match.mentor : match.mentee;
  const roleName = role === 'mentee' ? RoleName.MENTEE : RoleName.MENTOR;

  const [profile, approvedGoal, midterm, final] = await Promise.all([
    role === 'mentee'
      ? prisma.menteeProfile.findFirst({
          where: {
            userId: recipient.id,
            cohortId: match.cohortId,
            deletedAt: null,
          },
          select: { trainingStatus: true, updatedAt: true },
        })
      : prisma.mentorProfile.findFirst({
          where: {
            userId: recipient.id,
            cohortId: match.cohortId,
            deletedAt: null,
          },
          select: { trainingStatus: true, updatedAt: true },
        }),
    prisma.goal.findFirst({
      where: {
        cohortId: match.cohortId,
        menteeId: match.menteeId,
        status: { in: [GoalStatus.APPROVED, GoalStatus.COMPLETED] },
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.formResponse.findFirst({
      where: {
        respondentId: recipient.id,
        status: ReviewStatus.SUBMITTED,
        deletedAt: null,
        form: {
          cohortId: match.cohortId,
          type: ReviewType.MIDTERM,
          roleName,
          deletedAt: null,
        },
      },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    }),
    prisma.formResponse.findFirst({
      where: {
        respondentId: recipient.id,
        status: ReviewStatus.SUBMITTED,
        deletedAt: null,
        form: {
          cohortId: match.cohortId,
          type: ReviewType.FINAL,
          roleName,
          deletedAt: null,
        },
      },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    }),
  ]);

  // Mirrors the existing journey completion rule exactly. This fixes the former
  // certificate shortcut that ignored both reviews while the UI promised them.
  const eligibility: CertificateEligibility = {
    trainingCompleted: profile?.trainingStatus === TrainingStatus.COMPLETED,
    goalApproved: approvedGoal !== null,
    midtermSubmitted: midterm !== null,
    finalSubmitted: final !== null,
  };
  const earned = Object.values(eligibility).every(Boolean);
  const completionDate = latestDate([
    approvedGoal?.updatedAt,
    midterm?.submittedAt,
    final?.submittedAt,
    match.cohort.endDate && match.cohort.endDate <= new Date()
      ? match.cohort.endDate
      : null,
  ]);
  const issuedDate = (earned ? completionDate : new Date())
    .toISOString()
    .slice(0, 10);

  return {
    matchId: match.id,
    cohortId: match.cohortId,
    recipientId: recipient.id,
    recipientName: recipient.name?.trim() || 'Participant',
    recipientLocale: asCertificateLanguage(recipient.locale),
    role,
    programmeName: match.cohort.programme.name,
    cohortName: match.cohort.name,
    counterpartName: counterpart.name?.trim() || null,
    earned,
    eligibility,
    issuedDate,
    certificateId: createCertificateId(
      match.id,
      role,
      completionDate.getUTCFullYear(),
    ),
  };
}

export async function getCertificateData(
  userId: string,
): Promise<CertificateData | null> {
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.ACCEPTED,
      deletedAt: null,
      OR: [{ menteeId: userId }, { mentorId: userId }],
    },
    orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, menteeId: true },
  });
  if (!match) return null;

  const fullMatch = await loadMatch(match.id);
  if (!fullMatch) return null;
  return buildCertificateData(
    fullMatch,
    match.menteeId === userId ? 'mentee' : 'mentor',
  );
}

export async function getCertificateForViewer(
  viewer: SessionUser,
  matchId: string,
  role: CertificateRole,
): Promise<CertificateData | null> {
  const match = await loadMatch(matchId);
  if (!match) return null;

  const recipientId = role === 'mentee' ? match.menteeId : match.mentorId;
  const ownsCertificate = viewer.id === recipientId;
  const isScopedAdmin =
    hasAnyRole(viewer, ADMIN_ROLES) && canAccessCohort(viewer, match.cohortId);
  if (!ownsCertificate && !isScopedAdmin) return null;

  return buildCertificateData(match, role);
}

export async function getAdminCertificateCandidates(
  admin: SessionUser,
): Promise<CertificateData[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.ACCEPTED,
      deletedAt: null,
      ...adminCohortFilter(admin),
    },
    orderBy: [{ cohort: { name: 'asc' } }, { mentee: { name: 'asc' } }],
    select: { id: true },
  });

  const rows = await Promise.all(
    matches.flatMap(({ id }) =>
      (['mentee', 'mentor'] as const).map(async (role) => {
        const match = await loadMatch(id);
        return match ? buildCertificateData(match, role) : null;
      }),
    ),
  );

  return rows.filter((row): row is CertificateData => row !== null);
}
