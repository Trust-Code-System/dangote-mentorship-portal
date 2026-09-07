import 'server-only';
import { NewsletterStatus, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { SessionUser } from '@/lib/auth/rbac';
import { canAccessCohort } from '@/lib/auth/rbac';
import { parseNewsletterBody, type NewsletterBody } from './schema';

// Reads for the admin newsletter area (CLAUDE.md §10, §13 "Newsletters").
// Newsletters are admin-only; every read is confined to the admin's cohort scope.

export interface NewsletterSummary {
  id: string;
  title: string;
  subjectEn: string | null;
  status: NewsletterStatus;
  aiDrafted: boolean;
  fromSchedule: boolean;
  scheduledAt: Date | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  recipientCount: number;
  sentCount: number;
  createdAt: Date;
}

export interface NewsletterDetail extends NewsletterSummary {
  cohortId: string;
  cohortName: string;
  subjectFr: string | null;
  body: NewsletterBody | null;
  approvedByName: string | null;
}

export async function listNewsletters(
  user: SessionUser,
  cohortId: string,
): Promise<NewsletterSummary[]> {
  if (!canAccessCohort(user, cohortId)) return [];

  const newsletters = await prisma.newsletter.findMany({
    where: { cohortId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      title: true,
      subjectEn: true,
      status: true,
      aiDrafted: true,
      scheduleId: true,
      scheduledAt: true,
      sentAt: true,
      approvedAt: true,
      createdAt: true,
      recipients: { select: { sentAt: true } },
    },
  });

  return newsletters.map((newsletter) => ({
    id: newsletter.id,
    title: newsletter.title,
    subjectEn: newsletter.subjectEn,
    status: newsletter.status,
    aiDrafted: newsletter.aiDrafted,
    fromSchedule: newsletter.scheduleId !== null,
    scheduledAt: newsletter.scheduledAt,
    sentAt: newsletter.sentAt,
    approvedAt: newsletter.approvedAt,
    recipientCount: newsletter.recipients.length,
    sentCount: newsletter.recipients.filter((r) => r.sentAt !== null).length,
    createdAt: newsletter.createdAt,
  }));
}

export async function getNewsletter(
  user: SessionUser,
  newsletterId: string,
): Promise<NewsletterDetail | null> {
  const newsletter = await prisma.newsletter.findFirst({
    where: { id: newsletterId, deletedAt: null },
    select: {
      id: true,
      cohortId: true,
      title: true,
      subjectEn: true,
      subjectFr: true,
      bodyJson: true,
      status: true,
      aiDrafted: true,
      scheduleId: true,
      scheduledAt: true,
      sentAt: true,
      approvedAt: true,
      createdAt: true,
      cohort: { select: { name: true } },
      approvedBy: { select: { name: true, email: true } },
      recipients: { select: { sentAt: true } },
    },
  });
  if (!newsletter) return null;
  if (!canAccessCohort(user, newsletter.cohortId)) return null;

  return {
    id: newsletter.id,
    cohortId: newsletter.cohortId,
    cohortName: newsletter.cohort.name,
    title: newsletter.title,
    subjectEn: newsletter.subjectEn,
    subjectFr: newsletter.subjectFr,
    body: parseNewsletterBody(newsletter.bodyJson),
    status: newsletter.status,
    aiDrafted: newsletter.aiDrafted,
    fromSchedule: newsletter.scheduleId !== null,
    scheduledAt: newsletter.scheduledAt,
    sentAt: newsletter.sentAt,
    approvedAt: newsletter.approvedAt,
    approvedByName: newsletter.approvedBy
      ? (newsletter.approvedBy.name ?? newsletter.approvedBy.email)
      : null,
    recipientCount: newsletter.recipients.length,
    sentCount: newsletter.recipients.filter((r) => r.sentAt !== null).length,
    createdAt: newsletter.createdAt,
  };
}

export interface ScheduleSettings {
  cohortId: string;
  enabled: boolean;
  sendDays: number[];
  sendHour: number;
  timezone: string;
  autoDraft: boolean;
  lastDraftedFor: Date | null;
}

/** The cohort's schedule, or sensible defaults when none exists yet. */
export async function getScheduleSettings(cohortId: string): Promise<ScheduleSettings> {
  const schedule = await prisma.newsletterSchedule.findFirst({
    where: { cohortId, deletedAt: null },
    select: {
      enabled: true,
      sendDays: true,
      sendHour: true,
      timezone: true,
      autoDraft: true,
      lastDraftedFor: true,
    },
  });

  return {
    cohortId,
    // Default cadence matches how the programme actually runs it: twice a week,
    // Monday and Thursday morning, Lagos time.
    enabled: schedule?.enabled ?? false,
    sendDays: schedule?.sendDays ?? [1, 4],
    sendHour: schedule?.sendHour ?? 9,
    timezone: schedule?.timezone ?? 'Africa/Lagos',
    autoDraft: schedule?.autoDraft ?? true,
    lastDraftedFor: schedule?.lastDraftedFor ?? null,
  };
}

export interface RecipientRow {
  userId: string;
  email: string;
  name: string | null;
  locale: 'EN' | 'FR';
}

/**
 * Who a newsletter goes to: every active mentor and mentee in the cohort, with
 * the language to send them. Admins are not on the list — they are the sender.
 */
export async function listCohortRecipients(cohortId: string): Promise<RecipientRow[]> {
  const grants = await prisma.userRole.findMany({
    where: {
      cohortId,
      deletedAt: null,
      role: { name: { in: [RoleName.MENTOR, RoleName.MENTEE] } },
      user: { isActive: true, deletedAt: null },
    },
    select: { user: { select: { id: true, email: true, name: true, locale: true } } },
  });

  const byId = new Map<string, RecipientRow>();
  for (const grant of grants) {
    byId.set(grant.user.id, {
      userId: grant.user.id,
      email: grant.user.email,
      name: grant.user.name,
      locale: grant.user.locale === 'FR' ? 'FR' : 'EN',
    });
  }
  return Array.from(byId.values());
}
