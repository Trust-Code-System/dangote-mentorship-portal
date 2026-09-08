'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { getStorageProvider } from '@/lib/storage';
import { canUseDirectUploads, createSignedUploadTarget, removeStoredObject } from '@/lib/storage/direct';
import { verifyFileSignature } from '@/lib/files/sniff';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';

export type ProfileActionState = ActionResult<{ id: string }> | null;

// Own-profile editing only: identity comes from the session, never the form.
// Admin-side profile management stays in the import/commit pipeline for M1.

const sharedFields = {
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  department: z.string().trim().max(120).optional().or(z.literal('')),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  personality: z.string().trim().max(120).optional().or(z.literal('')),
  interests: z.string().trim().max(1000).optional().or(z.literal('')),
};

const mentorSchema = z.object({
  ...sharedFields,
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  whyMentor: z.string().trim().max(2000).optional().or(z.literal('')),
  whatCanLearn: z.string().trim().max(2000).optional().or(z.literal('')),
  availability: z.string().trim().max(500).optional().or(z.literal('')),
});

const menteeSchema = z.object({
  ...sharedFields,
  currentGrade: z.string().trim().max(120).optional().or(z.literal('')),
  whyMentor: z.string().trim().max(2000).optional().or(z.literal('')),
  careerGoals: z.string().trim().max(2000).optional().or(z.literal('')),
});

function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

// Account-level fields every user has, regardless of mentorship role. Email is
// the sign-in identity and is never edited here; preferred language is owned by
// the header locale switcher (see src/i18n/actions.ts).
const accountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(60),
});

// Void wrappers for plain RSC <form action> usage (which requires
// void-returning actions). The typed variants stay the canonical API.
export async function updateOwnMentorProfileForm(formData: FormData): Promise<void> {
  await updateOwnMentorProfile(formData);
}

export async function updateOwnMenteeProfileForm(formData: FormData): Promise<void> {
  await updateOwnMenteeProfile(formData);
}

export async function updateOwnAccountForm(formData: FormData): Promise<void> {
  await updateOwnAccount(formData);
}

// Editable for ALL users (admins included), so everyone has a profile section.
export async function updateOwnAccount(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = accountSchema.parse(Object.fromEntries(formData));

    await prisma.user.update({
      where: { id: user.id },
      data: { name: data.name, timezone: data.timezone },
    });

    await writeAuditLog({
      actorId: user.id,
      action: 'profile.account_updated',
      entityType: 'User',
      entityId: user.id,
    });

    revalidatePath('/profile');
    return ok({ id: user.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateOwnMentorProfile(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: user.id } });
    if (!profile || profile.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'You do not have a mentor profile.' });
    }

    const data = mentorSchema.parse(Object.fromEntries(formData));
    await prisma.mentorProfile.update({
      where: { id: profile.id },
      data: {
        phone: emptyToNull(data.phone),
        department: emptyToNull(data.department),
        jobTitle: emptyToNull(data.jobTitle),
        location: emptyToNull(data.location),
        personality: emptyToNull(data.personality),
        interests: emptyToNull(data.interests),
        yearsExperience: data.yearsExperience ?? profile.yearsExperience,
        whyMentor: emptyToNull(data.whyMentor),
        whatCanLearn: emptyToNull(data.whatCanLearn),
        availability: emptyToNull(data.availability),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: profile.cohortId,
      action: 'profile.mentor_updated',
      entityType: 'MentorProfile',
      entityId: profile.id,
    });

    revalidatePath('/profile');
    return ok({ id: profile.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateOwnMenteeProfile(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const profile = await prisma.menteeProfile.findUnique({ where: { userId: user.id } });
    if (!profile || profile.deletedAt) {
      return fail({ code: 'NOT_FOUND', message: 'You do not have a mentee profile.' });
    }

    const data = menteeSchema.parse(Object.fromEntries(formData));
    await prisma.menteeProfile.update({
      where: { id: profile.id },
      data: {
        phone: emptyToNull(data.phone),
        department: emptyToNull(data.department),
        jobTitle: emptyToNull(data.jobTitle),
        location: emptyToNull(data.location),
        personality: emptyToNull(data.personality),
        interests: emptyToNull(data.interests),
        currentGrade: emptyToNull(data.currentGrade),
        whyMentor: emptyToNull(data.whyMentor),
        careerGoals: emptyToNull(data.careerGoals),
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: profile.cohortId,
      action: 'profile.mentee_updated',
      entityType: 'MenteeProfile',
      entityId: profile.id,
    });

    revalidatePath('/profile');
    return ok({ id: profile.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── Profile photo (avatar) ──────────────────────────────────────────────────
// Available to every user. The image is stored behind the storage seam and
// served only through the authorized /api/avatar route (never a public URL);
// User.image holds the opaque storage key.

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const avatarUploadInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim(),
  size: z.number().int().positive().max(MAX_AVATAR_BYTES),
});

function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}/${randomUUID()}${ext}`;
}

export async function prepareOwnAvatarUpload(input: {
  name: string;
  type: string;
  size: number;
}): Promise<ActionResult<{ mode: 'direct'; bucket: string; path: string; token: string } | { mode: 'server' }>> {
  try {
    const user = await requireUser();
    const file = avatarUploadInput.parse(input);
    const ext = ALLOWED_AVATAR_TYPES[file.type];
    if (!ext) {
      return fail({ code: 'VALIDATION', message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
    }
    if (!canUseDirectUploads()) return ok({ mode: 'server' });
    const target = await createSignedUploadTarget(avatarKey(user.id, ext));
    return ok({ mode: 'direct', ...target });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function confirmOwnAvatarUpload(input: {
  path: string;
  type: string;
  size: number;
}): Promise<ProfileActionState> {
  try {
    const user = await requireUser();
    const file = avatarUploadInput.omit({ name: true }).parse(input);
    const ext = ALLOWED_AVATAR_TYPES[file.type];
    if (!ext || !input.path.startsWith(`avatars/${user.id}/`) || !input.path.endsWith(ext)) {
      return fail({ code: 'FORBIDDEN', message: 'The upload target is not valid for this account.' });
    }

    const bytes = await getStorageProvider().get(input.path);
    if (bytes.byteLength !== file.size || !verifyFileSignature(bytes, file.type)) {
      await removeStoredObject(input.path);
      return fail({ code: 'VALIDATION', message: "Image contents don't match the selected file." });
    }

    await prisma.user.update({ where: { id: user.id }, data: { image: input.path } });
    await writeAuditLog({
      actorId: user.id,
      action: 'profile.avatar_updated',
      entityType: 'User',
      entityId: user.id,
    });
    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return ok({ id: user.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function uploadOwnAvatar(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const user = await requireUser();

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail({ code: 'VALIDATION', message: 'Choose an image to upload.' });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return fail({ code: 'VALIDATION', message: 'Image is too large (max 5 MB).' });
    }
    const ext = ALLOWED_AVATAR_TYPES[file.type];
    if (!ext) {
      return fail({ code: 'VALIDATION', message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
    }

    const key = avatarKey(user.id, ext);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!verifyFileSignature(bytes, file.type)) {
      return fail({ code: 'VALIDATION', message: "Image contents don't match its type." });
    }
    await getStorageProvider().put({ key, bytes, contentType: file.type });

    await prisma.user.update({ where: { id: user.id }, data: { image: key } });

    await writeAuditLog({
      actorId: user.id,
      action: 'profile.avatar_updated',
      entityType: 'User',
      entityId: user.id,
    });

    // Avatar appears in the shell (top bar + sidebar) across every page.
    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return ok({ id: user.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function removeOwnAvatar(
  _prev: ProfileActionState,
  _formData: FormData,
): Promise<ProfileActionState> {
  try {
    const user = await requireUser();
    // Soft-clear the reference; the stored object is left for scheduled purge so
    // we never hard-delete user content inline (CLAUDE.md §16).
    await prisma.user.update({ where: { id: user.id }, data: { image: null } });

    await writeAuditLog({
      actorId: user.id,
      action: 'profile.avatar_removed',
      entityType: 'User',
      entityId: user.id,
    });

    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return ok({ id: user.id });
  } catch (error) {
    return mapActionError(error);
  }
}
