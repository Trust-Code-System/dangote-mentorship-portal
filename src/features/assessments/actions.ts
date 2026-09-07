'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, ReviewStatus, ReviewType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assertCohortAccess, requireRole, requireUser } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { writeAuditLog } from '@/lib/audit/audit';
import { fail, mapActionError, ok, type ActionResult } from '@/lib/actions/result';
import { getFormDefinition } from '@/features/forms/data';
import { validateAnswers } from '@/features/reviews/schema';
import { resolveParticipantCohortId } from './data';
import { isRecurringFormType, respondentRoleFor } from './participants';
import {
  defaultMonthlyWindowLabel,
  defaultWindowLabel,
  planAssessmentWindows,
  planMonthlyWindows,
} from './schedule';
import {
  cohortIdSchema,
  generateWindowsSchema,
  submitAssessmentSchema,
  toggleWindowSchema,
  updateWindowSchema,
} from './schema';

// Mutations for the recurring quarterly assessment. Every one follows the §3
// pipeline: authenticate → authorize → validate (Zod + per-field) → execute →
// audit → typed result. Audit metadata carries ids and counts only, never
// answer bodies (§14).

export async function submitAssessment(
  formData: FormData,
): Promise<ActionResult<{ responseId: string }>> {
  try {
    const user = await requireUser();

    const input = submitAssessmentSchema.parse({
      formId: formData.get('formId'),
      windowId: formData.get('windowId'),
      answers: formData.get('answers'),
    });

    // Authorize: a participant may only submit a form their own role owes, and
    // only in their own cohort. Which role they answer as also determines which
    // question set is legitimate for them (see participants.ts).
    const cohortId = await resolveParticipantCohortId(user.id);
    if (!cohortId) {
      return fail({ code: 'FORBIDDEN', message: 'You are not enrolled in a cohort.' });
    }

    // Cohort-isolation guard on both the window and the form (IDOR defence —
    // cf. the M2 audit H1 finding): both must belong to this mentee's cohort.
    const window = await prisma.assessmentWindow.findFirst({
      where: { id: input.windowId, cohortId, isActive: true, deletedAt: null },
      select: { id: true, label: true, opensAt: true, formType: true },
    });
    if (!window) {
      return fail({ code: 'NOT_FOUND', message: 'This assessment is not available.' });
    }
    if (window.opensAt.getTime() > Date.now()) {
      return fail({ code: 'CONFLICT', message: 'This assessment has not opened yet.' });
    }

    // The form must be a recurring mentee form AND must match the window's own
    // type — otherwise a monthly window could be satisfied by submitting the
    // quarterly form, which would quietly clear the wrong obligation.
    const form = await getFormDefinition(input.formId);
    if (
      !form ||
      form.cohortId !== cohortId ||
      !isRecurringFormType(form.type) ||
      form.type !== window.formType ||
      !form.isActive
    ) {
      return fail({ code: 'NOT_FOUND', message: 'This form is not available.' });
    }

    // The form's own audience must include this user's role — otherwise a
    // mentor could submit the mentee question set (or vice versa) and clear an
    // obligation with the wrong answers.
    const respondentRole = respondentRoleFor(user.roles, form.type);
    if (!respondentRole) {
      return fail({
        code: 'FORBIDDEN',
        message: 'This form is not one your role completes.',
      });
    }
    if (form.roleName !== null && form.roleName !== respondentRole) {
      return fail({
        code: 'FORBIDDEN',
        message: 'This form is intended for a different role.',
      });
    }

    const validated = validateAnswers(form.schema, input.answers);
    if (!validated.ok) {
      return fail({
        code: 'VALIDATION',
        message: 'Some answers need attention.',
        fieldErrors: Object.fromEntries(
          Object.entries(validated.fieldErrors).map(([k, v]) => [k, [v]]),
        ),
      });
    }

    const answersJson = validated.answers as Prisma.InputJsonValue;

    // One submission per mentee per window: re-opening it updates in place.
    const existing = await prisma.formResponse.findFirst({
      where: { assessmentWindowId: window.id, respondentId: user.id, deletedAt: null },
      select: { id: true },
    });

    const response = existing
      ? await prisma.formResponse.update({
          where: { id: existing.id },
          data: {
            formId: form.id,
            answers: answersJson,
            status: ReviewStatus.SUBMITTED,
            submittedAt: new Date(),
          },
          select: { id: true },
        })
      : await prisma.formResponse.create({
          data: {
            formId: form.id,
            respondentId: user.id,
            assessmentWindowId: window.id,
            answers: answersJson,
            status: ReviewStatus.SUBMITTED,
            submittedAt: new Date(),
          },
          select: { id: true },
        });

    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: existing ? 'assessment.updated' : 'assessment.submitted',
      entityType: 'FormResponse',
      entityId: response.id,
      metadata: {
        windowId: window.id,
        formId: form.id,
        formType: window.formType,
        respondentRole,
        fieldCount: form.schema.fields.length,
      },
    });

    // Submitting can lift a portal lock, so refresh the whole authenticated
    // area rather than just this page.
    revalidatePath('/', 'layout');
    return ok({ responseId: response.id });
  } catch (error) {
    return mapActionError(error);
  }
}

/** useActionState wrapper for the mentee assessment form. */
export type AssessmentFormState = ActionResult<{ responseId: string }> | null;

export async function submitAssessmentForm(
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  return submitAssessment(formData);
}

// ── Admin: manage the cohort's assessment windows ───────────────────────────

/**
 * Create any missing windows for a cohort from its start date. Idempotent:
 * existing sequences are left exactly as the admin edited them, so re-running
 * this after extending a cohort only tops up the new occurrences.
 */
export async function generateAssessmentWindows(
  formData: FormData,
): Promise<ActionResult<{ created: number }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = generateWindowsSchema.parse({
      cohortId: formData.get('cohortId'),
      intervalMonths: formData.get('intervalMonths'),
      graceDays: formData.get('graceDays'),
    });
    assertCohortAccess(user, input.cohortId);

    const cohort = await prisma.cohort.findFirst({
      where: { id: input.cohortId, deletedAt: null },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!cohort) return fail({ code: 'NOT_FOUND', message: 'Cohort not found.' });
    if (!cohort.startDate) {
      return fail({
        code: 'CONFLICT',
        message: 'Set the cohort start date before generating assessments.',
      });
    }

    const plans = planAssessmentWindows({
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      intervalMonths: input.intervalMonths,
    });

    const existing = await prisma.assessmentWindow.findMany({
      where: { cohortId: cohort.id, formType: ReviewType.QUARTERLY, deletedAt: null },
      select: { sequence: true },
    });
    const taken = new Set(existing.map((w) => w.sequence));
    const toCreate = plans.filter((p) => !taken.has(p.sequence));

    // Persist the cadence on the cohort so the next generate run and the admin
    // screen agree on the defaults.
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: {
        assessmentIntervalMonths: input.intervalMonths,
        assessmentGraceDays: input.graceDays,
      },
    });

    if (toCreate.length > 0) {
      await prisma.assessmentWindow.createMany({
        data: toCreate.map((plan) => ({
          cohortId: cohort.id,
          formType: ReviewType.QUARTERLY,
          gatesAccess: true,
          sequence: plan.sequence,
          label: defaultWindowLabel(plan),
          opensAt: plan.opensAt,
          dueAt: plan.dueAt,
          graceDays: input.graceDays,
        })),
      });
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId: cohort.id,
      action: 'assessment_window.generated',
      entityType: 'AssessmentWindow',
      metadata: {
        intervalMonths: input.intervalMonths,
        graceDays: input.graceDays,
        planned: plans.length,
        created: toCreate.length,
      },
    });

    revalidatePath('/admin/assessments');
    return ok({ created: toCreate.length });
  } catch (error) {
    return mapActionError(error);
  }
}

/**
 * Create any missing monthly meeting-form windows for a cohort — one per
 * calendar month it runs in. Idempotent like the quarterly generator.
 *
 * These windows are created with `gatesAccess: false`: a mentee who misses the
 * monthly form is reminded, never locked out. `graceDays` is 0 because there is
 * nothing to be lenient about when nothing is being withheld — it only affects
 * when the reminder escalates to "overdue".
 */
export async function generateMonthlyWindows(
  formData: FormData,
): Promise<ActionResult<{ created: number }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const { cohortId } = cohortIdSchema.parse({ cohortId: formData.get('cohortId') });
    assertCohortAccess(user, cohortId);

    const cohort = await prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!cohort) return fail({ code: 'NOT_FOUND', message: 'Cohort not found.' });
    if (!cohort.startDate) {
      return fail({
        code: 'CONFLICT',
        message: 'Set the cohort start date before generating monthly forms.',
      });
    }

    const plans = planMonthlyWindows({
      startDate: cohort.startDate,
      endDate: cohort.endDate,
    });

    const existing = await prisma.assessmentWindow.findMany({
      where: { cohortId: cohort.id, formType: ReviewType.MONTHLY, deletedAt: null },
      select: { sequence: true },
    });
    const taken = new Set(existing.map((w) => w.sequence));
    const toCreate = plans.filter((plan) => !taken.has(plan.sequence));

    if (toCreate.length > 0) {
      await prisma.assessmentWindow.createMany({
        data: toCreate.map((plan) => ({
          cohortId: cohort.id,
          formType: ReviewType.MONTHLY,
          gatesAccess: false,
          sequence: plan.sequence,
          label: defaultMonthlyWindowLabel(plan),
          opensAt: plan.opensAt,
          dueAt: plan.dueAt,
          graceDays: 0,
        })),
      });
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId: cohort.id,
      action: 'monthly_window.generated',
      entityType: 'AssessmentWindow',
      metadata: { planned: plans.length, created: toCreate.length },
    });

    revalidatePath('/admin/assessments');
    return ok({ created: toCreate.length });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateAssessmentWindow(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = updateWindowSchema.parse({
      windowId: formData.get('windowId'),
      label: formData.get('label'),
      opensAt: formData.get('opensAt'),
      dueAt: formData.get('dueAt'),
      graceDays: formData.get('graceDays'),
      isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    });

    const window = await prisma.assessmentWindow.findFirst({
      where: { id: input.windowId, deletedAt: null },
      select: { id: true, cohortId: true },
    });
    if (!window) return fail({ code: 'NOT_FOUND', message: 'Assessment not found.' });
    assertCohortAccess(user, window.cohortId);

    await prisma.assessmentWindow.update({
      where: { id: window.id },
      data: {
        label: input.label,
        opensAt: input.opensAt,
        dueAt: input.dueAt,
        graceDays: input.graceDays,
        isActive: input.isActive,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: window.cohortId,
      action: 'assessment_window.updated',
      entityType: 'AssessmentWindow',
      entityId: window.id,
      metadata: {
        label: input.label,
        dueAt: input.dueAt.toISOString(),
        graceDays: input.graceDays,
        isActive: input.isActive,
      },
    });

    // Moving a due date can lock or unlock mentees immediately.
    revalidatePath('/', 'layout');
    return ok({ id: window.id });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setAssessmentWindowActive(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRole(ADMIN_ROLES);
    const input = toggleWindowSchema.parse({
      windowId: formData.get('windowId'),
      isActive: formData.get('isActive'),
    });

    const window = await prisma.assessmentWindow.findFirst({
      where: { id: input.windowId, deletedAt: null },
      select: { id: true, cohortId: true },
    });
    if (!window) return fail({ code: 'NOT_FOUND', message: 'Assessment not found.' });
    assertCohortAccess(user, window.cohortId);

    await prisma.assessmentWindow.update({
      where: { id: window.id },
      data: { isActive: input.isActive },
    });

    await writeAuditLog({
      actorId: user.id,
      cohortId: window.cohortId,
      action: input.isActive ? 'assessment_window.activated' : 'assessment_window.deactivated',
      entityType: 'AssessmentWindow',
      entityId: window.id,
    });

    revalidatePath('/', 'layout');
    return ok({ id: window.id });
  } catch (error) {
    return mapActionError(error);
  }
}
