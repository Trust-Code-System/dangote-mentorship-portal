'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { mapActionError, ok, type ActionResult } from '@/lib/actions/result';

// Autosave drafts (experience-layer.md §1.11: "never lose work"). Drafts are
// transient working state scoped to the current user, so they are NOT audited
// (the eventual submit is the meaningful, audited mutation) and are hard-deleted
// on submit rather than soft-deleted — there is no content to retain.

const saveSchema = z.object({
  formKey: z.string().trim().min(1).max(120),
  cohortId: z.string().cuid().optional(),
  // Arbitrary JSON-serializable form values; validated by the real form's Zod
  // schema at submit time, not here.
  // Zod 4 requires an explicit key schema for z.record.
  data: z.record(z.string(), z.unknown()),
});

export type SaveDraftInput = z.infer<typeof saveSchema>;

export async function saveDraft(input: SaveDraftInput): Promise<ActionResult<{ savedAt: string }>> {
  try {
    const user = await requireUser({ allowGoalSetup: input?.formKey === 'goal:new' });
    const { formKey, cohortId, data } = saveSchema.parse(input);

    await prisma.formDraft.upsert({
      where: { userId_formKey: { userId: user.id, formKey } },
      update: { data: data as Prisma.InputJsonValue, cohortId: cohortId ?? null },
      create: { userId: user.id, formKey, cohortId: cohortId ?? null, data: data as Prisma.InputJsonValue },
    });

    return ok({ savedAt: new Date().toISOString() });
  } catch (error) {
    return mapActionError(error);
  }
}

const clearSchema = z.object({ formKey: z.string().trim().min(1).max(120) });

export async function clearDraft(input: { formKey: string }): Promise<ActionResult<{ cleared: boolean }>> {
  try {
    const user = await requireUser({ allowGoalSetup: input?.formKey === 'goal:new' });
    const { formKey } = clearSchema.parse(input);
    const result = await prisma.formDraft.deleteMany({ where: { userId: user.id, formKey } });
    return ok({ cleared: result.count > 0 });
  } catch (error) {
    return mapActionError(error);
  }
}
