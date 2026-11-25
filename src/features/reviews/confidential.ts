import 'server-only';
import { ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { parseFormSchema } from '@/features/forms/data';
import { writeAuditLog } from '@/lib/audit/audit';

export const concernReaderKey = (userId: string) => `review_concerns_reader:${userId}`;

/** Explicit per-person, per-cohort grants; administrator status is not a grant. */
export async function confidentialReviewCohorts(userId: string): Promise<string[]> {
  const flags = await prisma.featureFlag.findMany({
    where: {
      key: concernReaderKey(userId),
      enabled: true,
      cohortId: { not: null },
      deletedAt: null,
      cohort: { deletedAt: null },
    },
    select: { cohortId: true },
  });
  return flags.flatMap((f) => (f.cohortId ? [f.cohortId] : []));
}

export async function getConfidentialReviewResponses(userId: string, before?: string) {
  const cohorts = await confidentialReviewCohorts(userId);
  if (!cohorts.length) return null;
  const forms = await prisma.formDefinition.findMany({
    where: { cohortId: { in: cohorts }, deletedAt: null },
    include: { cohort: { select: { name: true } } },
  });
  const privateForms = forms
    .map((f) => ({
      ...f,
      fields: parseFormSchema(f.schema)?.fields.filter((field) => field.confidential) ?? [],
    }))
    .filter((f) => f.fields.length);
  if (
    before &&
    !(await prisma.formResponse.findFirst({
      where: {
        id: before,
        formId: { in: privateForms.map((f) => f.id) },
        status: ReviewStatus.SUBMITTED,
        deletedAt: null,
      },
      select: { id: true },
    }))
  )
    return [];
  const responses = await prisma.formResponse.findMany({
    where: {
      formId: { in: privateForms.map((f) => f.id) },
      status: ReviewStatus.SUBMITTED,
      deletedAt: null,
    },
    select: {
      id: true,
      formId: true,
      answers: true,
      submittedAt: true,
      respondent: { select: { name: true, email: true } },
    },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    cursor: before ? { id: before } : undefined,
    skip: before ? 1 : 0,
    take: 50,
  });
  for (const cohortId of cohorts)
    await writeAuditLog({
      actorId: userId,
      cohortId,
      action: 'review_confidential.viewed',
      entityType: 'FormResponse',
      metadata: {
        responseCount: responses.filter(
          (r) => privateForms.find((f) => f.id === r.formId)?.cohortId === cohortId,
        ).length,
      },
    });
  return responses.flatMap((r) => {
    const form = privateForms.find((f) => f.id === r.formId);
    if (!form) return [];
    const answers = r.answers as Record<string, unknown>;
    return [
      {
        id: r.id,
        title: form.title,
        cohort: form.cohort.name,
        respondent: r.respondent,
        submittedAt: r.submittedAt,
        answers: form.fields.map((f) => ({
          label: f.labelEn,
          value: renderAnswer(f, answers[f.id]),
        })),
      },
    ];
  });
}

function renderAnswer(
  field: { options?: { value: string; labelEn: string }[] },
  raw: unknown,
): string {
  const render = (value: unknown) =>
    field.options?.find((o) => o.value === String(value))?.labelEn ??
    String(value ?? 'Not answered');
  return Array.isArray(raw) ? raw.map(render).join(', ') : render(raw);
}
