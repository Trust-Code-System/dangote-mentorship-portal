'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assertCohortAccess, requireRole, type SessionUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit/audit';
import { STANDARD_FORMS, validateStandardForm } from './catalogue';
import { fail, mapActionError, ok, type ActionResult } from '@/lib/actions/result';
import {
  createFormDefinitionSchema,
  describeMissingFrenchLabels,
  formDefinitionIdSchema,
  installStandardFormsSchema,
  missingFrenchLabels,
  updateFormDefinitionSchema,
  type FormSchemaShape,
} from './schema';
import { asLanguageSource, getCohortLanguages } from '@/features/cohorts/language-data';
import { requiresFrench } from '@/features/cohorts/languages';

// Forms Builder mutations (CLAUDE.md §5 Reviews, §13). Admins author the
// mid/end review question sets here; the reviews fill flow (later M3 item)
// reads the active definitions. Every mutation: authn → authz → Zod → write →
// audit → typed result (CLAUDE.md §3).

async function assertCohort(
  actor: SessionUser,
  cohortId: string,
): Promise<ActionResult<never> | null> {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, deletedAt: null },
    select: { id: true },
  });
  if (!cohort) return fail({ code: 'NOT_FOUND', message: 'Cohort not found.' });
  assertCohortAccess(actor, cohortId);
  return null;
}

/**
 * French labels are required only for a cohort that actually runs in French
 * (CLAUDE.md §16 read precisely: don't force French *users* into English —
 * which says nothing about demanding French for a cohort that has none).
 *
 * Checked server-side against the form's real cohort, never a client-submitted
 * flag, so a tampered request cannot smuggle a French-less form into a
 * bilingual cohort.
 */
async function assertFrenchLabels(
  cohortId: string,
  schema: FormSchemaShape,
): Promise<ActionResult<never> | null> {
  const languages = await getCohortLanguages(cohortId);
  if (!requiresFrench(asLanguageSource(languages))) return null;
  const missing = missingFrenchLabels(schema);
  if (missing.length === 0) return null;
  return fail({ code: 'VALIDATION', message: describeMissingFrenchLabels(missing) });
}

export async function createFormDefinition(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const data = createFormDefinitionSchema.parse({
      cohortId: formData.get('cohortId'),
      type: formData.get('type'),
      roleName: formData.get('roleName') ?? '',
      title: formData.get('title'),
      schema: formData.get('schema'),
      isActive: formData.get('isActive') ?? 'true',
    });

    const cohortError = await assertCohort(actor, data.cohortId);
    if (cohortError) return cohortError;

    const frenchError = await assertFrenchLabels(data.cohortId, data.schema);
    if (frenchError) return frenchError;

    const definition = await prisma.formDefinition.create({
      data: {
        cohortId: data.cohortId,
        type: data.type,
        roleName: data.roleName,
        title: data.title,
        schema: data.schema,
        isActive: data.isActive,
      },
    });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: data.cohortId,
      action: 'form_definition.created',
      entityType: 'FormDefinition',
      entityId: definition.id,
      metadata: { type: data.type, roleName: data.roleName, fieldCount: data.schema.fields.length },
    });

    revalidatePath('/admin/forms');
    return ok({ id: definition.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateFormDefinition(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const data = updateFormDefinitionSchema.parse({
      id: formData.get('id'),
      cohortId: formData.get('cohortId'),
      type: formData.get('type'),
      roleName: formData.get('roleName') ?? '',
      title: formData.get('title'),
      schema: formData.get('schema'),
      isActive: formData.get('isActive') ?? 'true',
    });

    const existing = await prisma.formDefinition.findFirst({
      where: { id: data.id, deletedAt: null },
      select: { id: true, cohortId: true },
    });
    if (!existing) return fail({ code: 'NOT_FOUND', message: 'Form not found.' });
    // Check against the form's real cohort, not the client-submitted one.
    assertCohortAccess(actor, existing.cohortId);

    // Against the form's own cohort, not `data.cohortId`: this update never
    // moves a form between cohorts, so trusting the submitted id would let a
    // request name an English-only cohort to dodge a bilingual cohort's
    // French requirement.
    const frenchError = await assertFrenchLabels(existing.cohortId, data.schema);
    if (frenchError) return frenchError;

    await prisma.formDefinition.update({
      where: { id: data.id },
      data: {
        type: data.type,
        roleName: data.roleName,
        title: data.title,
        schema: data.schema,
        isActive: data.isActive,
      },
    });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: data.cohortId,
      action: 'form_definition.updated',
      entityType: 'FormDefinition',
      entityId: data.id,
      metadata: { type: data.type, fieldCount: data.schema.fields.length },
    });

    revalidatePath('/admin/forms');
    revalidatePath(`/admin/forms/${data.id}/edit`);
    return ok({ id: data.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function toggleFormDefinitionActive(
  formData: FormData,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const { id } = formDefinitionIdSchema.parse({ id: formData.get('id') });

    const existing = await prisma.formDefinition.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, isActive: true, cohortId: true },
    });
    if (!existing) return fail({ code: 'NOT_FOUND', message: 'Form not found.' });
    assertCohortAccess(actor, existing.cohortId);

    const next = !existing.isActive;
    await prisma.formDefinition.update({ where: { id }, data: { isActive: next } });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: existing.cohortId,
      action: next ? 'form_definition.activated' : 'form_definition.deactivated',
      entityType: 'FormDefinition',
      entityId: id,
    });

    revalidatePath('/admin/forms');
    return ok({ id, isActive: next });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function archiveFormDefinition(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(ADMIN_ROLES);
    const { id } = formDefinitionIdSchema.parse({ id: formData.get('id') });

    const existing = await prisma.formDefinition.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, cohortId: true },
    });
    if (!existing) return fail({ code: 'NOT_FOUND', message: 'Form not found.' });
    assertCohortAccess(actor, existing.cohortId);

    // Soft-delete only (CLAUDE.md §3): never hard-delete; existing responses keep
    // their definition reference.
    await prisma.formDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await writeAuditLog({
      actorId: actor.id,
      cohortId: existing.cohortId,
      action: 'form_definition.archived',
      entityType: 'FormDefinition',
      entityId: id,
    });

    revalidatePath('/admin/forms');
    return ok({ id });
  } catch (error) {
    return mapActionError(error);
  }
}

/**
 * Publish the programme's standard question sets into a cohort.
 *
 * Idempotent and non-destructive: it creates only the sets that are missing for
 * this cohort (matched on type + role) and never touches one that already
 * exists, so an admin's edits are safe and a second click does nothing. That
 * matters because forms are per-cohort by design, so every new cohort needs its
 * own copies — and hand-typing 37 bilingual questions is not a real option.
 */
export async function installStandardForms(
  formData: FormData,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { cohortId } = installStandardFormsSchema.parse({
      cohortId: formData.get('cohortId'),
    });
    assertCohortAccess(user, cohortId);

    const cohort = await prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: { id: true },
    });
    if (!cohort) return fail({ code: 'NOT_FOUND', message: 'Cohort not found.' });

    const existing = await prisma.formDefinition.findMany({
      where: { cohortId, deletedAt: null },
      select: { type: true, roleName: true },
    });
    const taken = new Set(existing.map((f) => `${f.type}:${f.roleName ?? 'ANY'}`));

    let created = 0;
    let skipped = 0;

    for (const form of STANDARD_FORMS) {
      if (taken.has(`${form.type}:${form.roleName}`)) {
        skipped += 1;
        continue;
      }

      // Validate before writing: a malformed catalogue entry should fail loudly
      // here rather than produce a form nobody can fill in.
      const valid = validateStandardForm(form);
      if (!valid.ok) {
        return fail({
          code: 'CONFLICT',
          message: `The standard "${form.title}" question set is invalid and was not installed.`,
        });
      }

      await prisma.formDefinition.create({
        data: {
          cohortId,
          type: form.type,
          roleName: form.roleName,
          title: form.title,
          isActive: true,
          schema: { fields: form.fields } as unknown as Prisma.InputJsonValue,
        },
      });
      created += 1;
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: 'form_definition.standard_installed',
      entityType: 'FormDefinition',
      metadata: { created, skipped, available: STANDARD_FORMS.length },
    });

    revalidatePath('/admin/forms');
    return ok({ created, skipped });
  } catch (error) {
    return mapActionError(error);
  }
}

