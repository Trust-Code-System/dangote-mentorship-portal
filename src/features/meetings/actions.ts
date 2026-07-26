'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { MatchStatus, MeetingStatus, MeetingType, NoShowReason } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify } from '@/lib/notifications/notify';
import { getMeetingProvider } from '@/lib/meetings';
import { getAiAdapter } from '@/lib/ai';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { checkRateLimit } from '@/lib/auth/rate-limit-shared';
import { isValidWindow, resolveNoShowReport } from './status';
import { getMeetingPrep } from './prepare-data';
import { buildPreparePrompt, parsePrepareResponse, type MeetingPrepResult } from './prepare';

// Meetings follow the CLAUDE.md §3 pipeline. Either party in an accepted pair may
// schedule. The calendar push (Outlook via Graph) is best-effort: a provider
// failure never blocks the meeting from being saved (mirrors the agreements PDF).

function parseDateTime(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface ResolvedPair {
  cohortId: string;
  mentorId: string;
  menteeId: string;
}

/** Resolve the accepted pairing between the user and a counterpart, either way round. */
async function resolvePair(userId: string, counterpartId: string): Promise<ResolvedPair | null> {
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.ACCEPTED,
      deletedAt: null,
      OR: [
        { mentorId: userId, menteeId: counterpartId },
        { mentorId: counterpartId, menteeId: userId },
      ],
    },
    select: { cohortId: true, mentorId: true, menteeId: true },
  });
  return match;
}

// ── Schedule ────────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  counterpartId: z.string().cuid(),
  title: z.string().trim().min(2).max(200),
  type: z.nativeEnum(MeetingType),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function scheduleMeeting(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = scheduleSchema.parse({
      counterpartId: formData.get('counterpartId'),
      title: formData.get('title'),
      type: formData.get('type'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt') || undefined,
      location: formData.get('location'),
      description: formData.get('description'),
    });

    const pair = await resolvePair(user.id, data.counterpartId);
    if (!pair) {
      return fail({ code: 'FORBIDDEN', message: 'You can only schedule with your accepted pair.' });
    }

    const startsAt = parseDateTime(data.startsAt);
    const endsAt = parseDateTime(data.endsAt);
    if (!isValidWindow(startsAt, endsAt)) {
      return fail({ code: 'VALIDATION', message: 'Choose a valid start (and an end after it).' });
    }

    const meeting = await prisma.meeting.create({
      data: {
        cohortId: pair.cohortId,
        organizerId: user.id,
        mentorId: pair.mentorId,
        menteeId: pair.menteeId,
        title: data.title,
        type: data.type,
        startsAt,
        endsAt,
        joinUrl: null,
        status: MeetingStatus.SCHEDULED,
      },
    });

    // Best-effort calendar push (§1.12): never let a provider error lose the meeting.
    const provider = getMeetingProvider();
    if (provider.enabled && startsAt) {
      try {
        const [organizer, counterpart] = await Promise.all([
          prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }),
          prisma.user.findUnique({ where: { id: data.counterpartId }, select: { email: true } }),
        ]);
        const result = await provider.createEvent({
          idempotencyKey: meeting.id,
          title: data.title,
          description: data.description || undefined,
          startsAt,
          endsAt: endsAt ?? new Date(startsAt.getTime() + 30 * 60 * 1000),
          organizerEmail: organizer?.email ?? '',
          attendeeEmails: counterpart?.email ? [counterpart.email] : [],
          location: data.location || undefined,
        });
        if (result.externalId || result.joinUrl) {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              externalId: result.externalId,
              joinUrl: result.joinUrl,
              provider: provider.id,
            },
          });
        }
      } catch (calendarError) {
        console.error('[meetings] calendar push failed', calendarError);
      }
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId: pair.cohortId,
      action: 'meeting.scheduled',
      entityType: 'Meeting',
      entityId: meeting.id,
      metadata: { type: data.type, counterpartId: data.counterpartId },
    });

    // Notify the counterpart that a session was scheduled (§1.10).
    await notify({
      userId: data.counterpartId,
      type: 'meeting_scheduled',
      params: {
        organizerName: user.name ?? '',
        title: data.title,
        date: startsAt ? startsAt.toISOString().slice(0, 10) : '',
      },
      link: '/meetings',
      cohortId: pair.cohortId,
    });

    revalidatePath('/meetings');
    return ok({ id: meeting.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Cancel ──────────────────────────────────────────────────────────────────

const idSchema = z.object({ meetingId: z.string().cuid() });

export async function cancelMeeting(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { meetingId } = idSchema.parse({ meetingId: formData.get('meetingId') });

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'Meeting not found.' });
    }
    const isParticipant = meeting.mentorId === user.id || meeting.menteeId === user.id;
    if (!isParticipant) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of this meeting.' });
    }
    if (meeting.status !== MeetingStatus.SCHEDULED) {
      return fail({ code: 'CONFLICT', message: 'Only a scheduled meeting can be cancelled.' });
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CANCELLED },
    });

    if (meeting.externalId) {
      const provider = getMeetingProvider();
      if (provider.enabled) {
        try {
          const organizer = await prisma.user.findUnique({
            where: { id: meeting.organizerId },
            select: { email: true },
          });
          await provider.cancelEvent(meeting.externalId, organizer?.email ?? '');
        } catch (calendarError) {
          console.error('[meetings] calendar cancel failed', calendarError);
        }
      }
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId: meeting.cohortId,
      action: 'meeting.cancelled',
      entityType: 'Meeting',
      entityId: meetingId,
    });

    // Tell the other participant the session was cancelled (§1.10, time-critical →
    // immediate email) so it reflects on their calendar/dashboard too.
    const otherId = meeting.mentorId === user.id ? meeting.menteeId : meeting.mentorId;
    await notify({
      userId: otherId,
      type: 'meeting_cancelled',
      params: {
        title: meeting.title,
        date: meeting.startsAt ? meeting.startsAt.toISOString().slice(0, 10) : '',
      },
      link: '/meetings',
      cohortId: meeting.cohortId,
    });

    revalidatePath('/meetings');
    return ok({ id: meetingId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── No-show / outcome capture (§1.14) ───────────────────────────────────────

const outcomeSchema = z.object({
  meetingId: z.string().cuid(),
  happened: z.enum(['yes', 'no']),
  reason: z.nativeEnum(NoShowReason).optional(),
});

/**
 * One-tap "Did this meeting happen?" (experience-layer.md §1.14). Either party
 * may answer; a "no" records the reason, feeding the risk monitor and heatmap
 * with the *why*, not just the *that*.
 */
export async function reportMeetingOutcome(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = outcomeSchema.parse({
      meetingId: formData.get('meetingId'),
      happened: formData.get('happened'),
      reason: (formData.get('reason') as string) || undefined,
    });

    const meeting = await prisma.meeting.findUnique({ where: { id: data.meetingId } });
    if (!meeting || meeting.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'Meeting not found.' });
    }
    const isParticipant = meeting.mentorId === user.id || meeting.menteeId === user.id;
    if (!isParticipant) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of this meeting.' });
    }
    if (meeting.status !== MeetingStatus.SCHEDULED || meeting.didHappen !== null) {
      return fail({ code: 'CONFLICT', message: 'This meeting outcome has already been recorded.' });
    }

    const happened = data.happened === 'yes';
    const resolution = resolveNoShowReport(happened, happened ? null : data.reason ?? NoShowReason.OTHER);

    await prisma.meeting.update({
      where: { id: data.meetingId },
      data: {
        didHappen: resolution.didHappen,
        status: resolution.status,
        noShowReason: resolution.noShowReason,
        noShowReportedById: user.id,
        noShowReportedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: meeting.cohortId,
      action: happened ? 'meeting.confirmed' : 'meeting.no_show',
      entityType: 'Meeting',
      entityId: data.meetingId,
      metadata: { reason: resolution.noShowReason },
    });

    revalidatePath('/meetings');
    return ok({ id: data.meetingId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── AI meeting preparation (§1.5) ───────────────────────────────────────────

const prepSchema = z.object({ meetingId: z.string().cuid() });

/**
 * Generate (or regenerate) the AI prep for a meeting and cache it on the row.
 * Participant-only. Advisory: the suggestion is cached for reuse, never written
 * into the session log. Degrades to the static prep when AI is off — the action
 * reports `aiEnabled:false` and caches nothing, so the view shows the fallback.
 */
export async function generateMeetingPrep(
  formData: FormData,
): Promise<ActionResult<{ aiEnabled: boolean; cached: boolean }>> {
  try {
    const user = await requireUser();
    const { meetingId } = prepSchema.parse({ meetingId: formData.get('meetingId') });

    const view = await getMeetingPrep(meetingId, user.id);
    if (!view) {
      return fail({ code: 'NOT_FOUND', message: 'Meeting not found.' });
    }

    const adapter = getAiAdapter();
    if (!adapter.enabled) {
      return ok({ aiEnabled: false, cached: false });
    }
    // Throttle the AI endpoint per user (production-readiness-report.md M1).
    if (!(await checkRateLimit(`ai:meeting-prep:${user.id}`, 10, 60_000)).ok) {
      return fail({ code: 'CONFLICT', message: 'Too many AI requests. Please wait a moment.' });
    }

    const lang = user.locale === 'FR' ? 'FR' : 'EN';
    let result: MeetingPrepResult | null = null;
    try {
      const raw = await adapter.complete({
        system:
          'You are the Meeting Preparation Assistant for a corporate mentorship ' +
          'programme. You only suggest; you never invent facts not in the context.',
        prompt: buildPreparePrompt(view.context, lang),
        temperature: 0.3,
        maxTokens: 700,
      });
      result = parsePrepareResponse(raw);
    } catch (error) {
      console.error('[meetings] prep request failed', error);
    }

    if (!result) {
      // AI returned nothing usable — leave any prior cache untouched.
      return ok({ aiEnabled: true, cached: false });
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { prepJson: result as unknown as object, prepGeneratedAt: new Date() },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId: view.meeting.cohortId,
      action: 'meeting.prep_generated',
      entityType: 'Meeting',
      entityId: meetingId,
      metadata: { adapter: adapter.id },
    });

    revalidatePath(`/meetings/${meetingId}/prepare`);
    return ok({ aiEnabled: true, cached: true });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function generateMeetingPrepAction(formData: FormData): Promise<void> {
  await generateMeetingPrep(formData);
}

// ── useActionState / void wrappers ──────────────────────────────────────────

export type MeetingActionState = ActionResult<{ id: string }> | null;

export async function scheduleMeetingForm(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  return scheduleMeeting(formData);
}
export async function cancelMeetingAction(formData: FormData): Promise<void> {
  await cancelMeeting(formData);
}
export async function reportMeetingOutcomeAction(formData: FormData): Promise<void> {
  await reportMeetingOutcome(formData);
}
