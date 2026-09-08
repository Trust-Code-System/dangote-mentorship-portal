'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Language, RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { requirePortalAccess } from '@/features/assessments/guard';
import { writeAuditLog } from '@/lib/audit/audit';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { mentorPairCohort } from '@/lib/pairings';
import { getMenteeCohortId } from './data';

// Reflection journal + mentor private notes (experience-layer.md §1.16). Same
// confidentiality posture as DMs (CLAUDE.md §7, §16): bodies are private to the
// owner; audit rows carry ids/flags only, never the written content. Sharing a
// reflection with one's mentor is an explicit, audited human action.

const langSchema = z.nativeEnum(Language).default(Language.EN);

function emptyToNull(value: string | undefined | null): string | null {
  return value && value.trim() ? value.trim() : null;
}

// ── Mentee reflection entries ───────────────────────────────────────────────

const saveEntrySchema = z.object({
  entryId: z.string().cuid().optional(),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  body: z.string().trim().min(1, 'Write something to save.').max(8000),
  sessionLogId: z.string().cuid().optional().or(z.literal('')),
  bodyLang: langSchema,
});

/**
 * Create or edit a private reflection entry. Mentee-only (CLAUDE.md §4: mentees
 * reflect on their own). New entries are private by default. An optional link to
 * one of the mentee's own session logs is verified before it is stored.
 */
export async function saveReflectionEntry(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    if (!hasAnyRole(user, RoleName.MENTEE)) {
      return fail({ code: 'FORBIDDEN', message: 'Only mentees keep a reflection journal.' });
    }
    const data = saveEntrySchema.parse({
      entryId: (formData.get('entryId') as string) || undefined,
      title: formData.get('title') ?? '',
      body: formData.get('body'),
      sessionLogId: (formData.get('sessionLogId') as string) || '',
      bodyLang: (formData.get('bodyLang') as string) || Language.EN,
    });

    const title = emptyToNull(data.title);
    const sessionLogId = data.sessionLogId ? data.sessionLogId : null;

    if (data.entryId) {
      const entry = await prisma.reflectionJournalEntry.findUnique({ where: { id: data.entryId } });
      if (!entry || entry.deletedAt || entry.authorId !== user.id) {
        return fail({ code: 'NOT_FOUND', message: 'Journal entry not found.' });
      }
      await prisma.reflectionJournalEntry.update({
        where: { id: entry.id },
        data: { title, body: data.body, bodyLang: data.bodyLang },
      });
      await writeAuditLog({
        actorId: user.id,
        cohortId: entry.cohortId,
        action: 'reflection_entry.updated',
        entityType: 'ReflectionJournalEntry',
        entityId: entry.id,
      });
      revalidatePath('/journal');
      return ok({ id: entry.id });
    }

    const cohortId = await getMenteeCohortId(user.id);
    if (!cohortId) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of an active cohort yet.' });
    }

    if (sessionLogId) {
      const log = await prisma.sessionLog.findUnique({
        where: { id: sessionLogId },
        select: { menteeId: true, deletedAt: true },
      });
      if (!log || log.deletedAt || log.menteeId !== user.id) {
        return fail({ code: 'NOT_FOUND', message: 'Session log not found.' });
      }
    }

    const entry = await prisma.reflectionJournalEntry.create({
      data: {
        cohortId,
        authorId: user.id,
        sessionLogId,
        title,
        body: data.body,
        bodyLang: data.bodyLang,
      },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: 'reflection_entry.created',
      entityType: 'ReflectionJournalEntry',
      entityId: entry.id,
      metadata: { linkedToSession: Boolean(sessionLogId) },
    });

    revalidatePath('/journal');
    return ok({ id: entry.id });
  } catch (error) {
    return mapActionError(error);
  }
}

const shareSchema = z.object({
  entryId: z.string().cuid(),
  shared: z.enum(['true', 'false']),
});

/**
 * Explicitly share / unshare a reflection with the mentee's mentor (§1.16). This
 * is the only path by which an entry becomes visible beyond its author, so it is
 * audited as a deliberate consent action.
 */
export async function setReflectionShared(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { entryId, shared } = shareSchema.parse({
      entryId: formData.get('entryId'),
      shared: formData.get('shared'),
    });

    const entry = await prisma.reflectionJournalEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.deletedAt || entry.authorId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Journal entry not found.' });
    }

    const isShared = shared === 'true';
    await prisma.reflectionJournalEntry.update({
      where: { id: entryId },
      data: { isSharedWithMentor: isShared, sharedAt: isShared ? new Date() : null },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId: entry.cohortId,
      action: isShared ? 'reflection_entry.shared' : 'reflection_entry.unshared',
      entityType: 'ReflectionJournalEntry',
      entityId: entryId,
    });

    revalidatePath('/journal');
    return ok({ id: entryId });
  } catch (error) {
    return mapActionError(error);
  }
}

const deleteEntrySchema = z.object({ entryId: z.string().cuid() });

/** Soft-delete a reflection entry (CLAUDE.md §16: never hard-delete). Author only. */
export async function deleteReflectionEntry(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { entryId } = deleteEntrySchema.parse({ entryId: formData.get('entryId') });

    const entry = await prisma.reflectionJournalEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.deletedAt || entry.authorId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Journal entry not found.' });
    }
    await prisma.reflectionJournalEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId: entry.cohortId,
      action: 'reflection_entry.deleted',
      entityType: 'ReflectionJournalEntry',
      entityId: entryId,
    });

    revalidatePath('/journal');
    return ok({ id: entryId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Mentor private notes ────────────────────────────────────────────────────

const saveNoteSchema = z.object({
  noteId: z.string().cuid().optional(),
  menteeId: z.string().cuid().optional(),
  kind: z.string().trim().max(40).optional().or(z.literal('')),
  body: z.string().trim().min(1, 'Write something to save.').max(8000),
  bodyLang: langSchema,
});

/**
 * Create or edit a mentor's private note about a mentee (§1.16). Private to the
 * mentor — never visible to the mentee or to admins. Creation requires an
 * accepted pairing; edits require ownership.
 */
export async function saveMentorNote(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    if (!hasAnyRole(user, RoleName.MENTOR)) {
      return fail({ code: 'FORBIDDEN', message: 'Only mentors keep private notes.' });
    }
    const data = saveNoteSchema.parse({
      noteId: (formData.get('noteId') as string) || undefined,
      menteeId: (formData.get('menteeId') as string) || undefined,
      kind: formData.get('kind') ?? '',
      body: formData.get('body'),
      bodyLang: (formData.get('bodyLang') as string) || Language.EN,
    });

    const kind = emptyToNull(data.kind);

    if (data.noteId) {
      const note = await prisma.mentorPrivateNote.findUnique({ where: { id: data.noteId } });
      if (!note || note.deletedAt || note.mentorId !== user.id) {
        return fail({ code: 'NOT_FOUND', message: 'Note not found.' });
      }
      await prisma.mentorPrivateNote.update({
        where: { id: note.id },
        data: { kind, body: data.body, bodyLang: data.bodyLang },
      });
      await writeAuditLog({
        actorId: user.id,
        cohortId: note.cohortId,
        action: 'mentor_note.updated',
        entityType: 'MentorPrivateNote',
        entityId: note.id,
      });
      revalidatePath('/journal');
      return ok({ id: note.id });
    }

    if (!data.menteeId) {
      return fail({ code: 'VALIDATION', message: 'Choose which mentee this note is about.' });
    }
    const cohortId = await mentorPairCohort(user.id, data.menteeId);
    if (!cohortId) {
      return fail({ code: 'FORBIDDEN', message: 'You are not paired with this mentee.' });
    }

    const note = await prisma.mentorPrivateNote.create({
      data: {
        cohortId,
        mentorId: user.id,
        menteeId: data.menteeId,
        kind,
        body: data.body,
        bodyLang: data.bodyLang,
      },
    });
    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: 'mentor_note.created',
      entityType: 'MentorPrivateNote',
      entityId: note.id,
      metadata: { menteeId: data.menteeId },
    });

    revalidatePath('/journal');
    return ok({ id: note.id });
  } catch (error) {
    return mapActionError(error);
  }
}

const deleteNoteSchema = z.object({ noteId: z.string().cuid() });

/** Soft-delete a mentor private note. Author only. */
export async function deleteMentorNote(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    // Assessment lock: a mentee with an overdue quarterly assessment cannot
    // act in the mentorship loop until they submit it (no-op for mentors/admins).
    await requirePortalAccess(user);
    const { noteId } = deleteNoteSchema.parse({ noteId: formData.get('noteId') });

    const note = await prisma.mentorPrivateNote.findUnique({ where: { id: noteId } });
    if (!note || note.deletedAt || note.mentorId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Note not found.' });
    }
    await prisma.mentorPrivateNote.update({ where: { id: noteId }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      actorId: user.id,
      cohortId: note.cohortId,
      action: 'mentor_note.deleted',
      entityType: 'MentorPrivateNote',
      entityId: noteId,
    });

    revalidatePath('/journal');
    return ok({ id: noteId });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState / void wrappers ──────────────────────────────────────────

export type ReflectionActionState = ActionResult<{ id: string }> | null;

export async function saveReflectionEntryForm(
  _prev: ReflectionActionState,
  formData: FormData,
): Promise<ReflectionActionState> {
  return saveReflectionEntry(formData);
}
export async function saveMentorNoteForm(
  _prev: ReflectionActionState,
  formData: FormData,
): Promise<ReflectionActionState> {
  return saveMentorNote(formData);
}
export async function setReflectionSharedAction(formData: FormData): Promise<void> {
  await setReflectionShared(formData);
}
export async function deleteReflectionEntryAction(formData: FormData): Promise<void> {
  await deleteReflectionEntry(formData);
}
export async function deleteMentorNoteAction(formData: FormData): Promise<void> {
  await deleteMentorNote(formData);
}
