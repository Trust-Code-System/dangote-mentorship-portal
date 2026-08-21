'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { assertCohortAccess, requireRole, type SessionUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit/audit';
import { fail, mapActionError, ok, type ActionResult } from '@/lib/actions/result';
import {
  createFormDefinitionSchema,
  formDefinitionIdSchema,
  updateFormDefinitionSchema,
} from './schema';

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
