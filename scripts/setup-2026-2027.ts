import { PrismaClient, CohortStatus, ProgrammeStatus, ReviewType, RoleName } from '@prisma/client';
import { PHASE2_FORMS, phase2MonthlyForm } from '../src/features/forms/phase2-catalogue';

// Explicitly operated release tool. Defaults to a read-only plan. Never changes
// participant memberships, existing programmes, old forms or their responses.
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const activate = process.argv.includes('--activate');
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const actorEmail = arg('actor');
const readerEmails = (arg('readers') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
if (!actorEmail || readerEmails.length !== 2)
  throw new Error(
    'Provide --actor=email and --readers=email,email. Use --apply only after reviewing the plan.',
  );

async function main() {
  const actor = await db.user.findFirst({
    where: {
      email: actorEmail,
      isActive: true,
      deletedAt: null,
      userRoles: {
        some: { deletedAt: null, cohortId: null, role: { name: RoleName.SUPER_ADMIN } },
      },
    },
    select: { id: true },
  });
  if (!actor) throw new Error('The operator must be an existing global super-admin.');
  const readers = await db.user.findMany({
    where: { email: { in: readerEmails }, deletedAt: null },
    select: { id: true, email: true },
  });
  if (readers.length !== 2)
    throw new Error(
      'Both named coordinator accounts must already exist. No new accounts or roles will be created.',
    );
  const existing = await db.programme.findFirst({
    where: { name: 'Dangote Mentorship 2026/2027', deletedAt: null },
    include: {
      cohorts: {
        where: { deletedAt: null },
        select: { id: true, name: true, startDate: true, endDate: true, languages: true },
      },
    },
  });
  const plan = {
    apply,
    activate,
    targetStatus: activate ? 'ACTIVE' : 'DRAFT',
    programme: 'Dangote Mentorship 2026/2027',
    cohort: '2026/2027 Stream',
    startDate: '2026-11-16',
    endDate: null,
    languages: ['EN'],
    existing: existing?.id ?? null,
    forms: [...PHASE2_FORMS, phase2MonthlyForm()].map((f) => ({
      type: f.type,
      role: f.roleName,
      title: f.title,
      fields: f.schema.fields.length,
    })),
    coordinatorAccounts: readers.map((r) => r.email),
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261116, 2027)`;
      const current = await tx.programme.findFirst({
        where: { name: plan.programme, deletedAt: null },
      });
      const programme =
        current ??
        (await tx.programme.create({
          data: {
            name: plan.programme,
            description: 'Dangote Mentorship Programme — 2026/2027 stream.',
            status: ProgrammeStatus.DRAFT,
          },
        }));
      let cohort = await tx.cohort.findFirst({
        where: { programmeId: programme.id, name: plan.cohort, deletedAt: null },
      });
      if (
        cohort &&
        (cohort.startDate?.toISOString().slice(0, 10) !== plan.startDate ||
          cohort.endDate ||
          cohort.languages.join(',') !== 'EN')
      )
        throw new Error(
          'An existing stream differs from the reviewed plan; review it before changing dates or languages.',
        );
      if (!cohort)
        cohort = await tx.cohort.create({
          data: {
            programmeId: programme.id,
            name: plan.cohort,
            startDate: new Date('2026-11-16T00:00:00.000Z'),
            endDate: null,
            languages: ['EN'],
            status: CohortStatus.DRAFT,
          },
        });
      const created: string[] = [];
      for (const form of [...PHASE2_FORMS, phase2MonthlyForm()]) {
        const found = await tx.formDefinition.findFirst({
          where: { cohortId: cohort.id, type: form.type, roleName: form.roleName, deletedAt: null },
        });
        if (found) {
          if (found.title !== form.title)
            throw new Error(
              'A different form already exists for this stream and role; refusing to replace it.',
            );
          continue;
        }
        const f = await tx.formDefinition.create({
          data: {
            cohortId: cohort.id,
            type: form.type,
            roleName: form.roleName,
            title: form.title,
            schema: form.schema,
            isActive: true,
          },
        });
        created.push(f.id);
      }
      const flags = [
        'phase2_goal_setting',
        ...readers.map((r) => `review_concerns_reader:${r.id}`),
      ];
      for (const key of flags)
        await tx.featureFlag.upsert({
          where: { key_cohortId: { key, cohortId: cohort.id } },
          create: { key, cohortId: cohort.id, enabled: true },
          update: { enabled: true, deletedAt: null },
        });
      const monthly = await tx.assessmentWindow.findFirst({
        where: { cohortId: cohort.id, formType: ReviewType.MONTHLY, sequence: 1, deletedAt: null },
      });
      if (!monthly)
        await tx.assessmentWindow.create({
          data: {
            cohortId: cohort.id,
            formType: ReviewType.MONTHLY,
            sequence: 1,
            label: 'November 2026 — monthly review',
            opensAt: new Date('2026-11-16T00:00:00Z'),
            dueAt: new Date('2026-11-30T23:59:59.999Z'),
            gatesAccess: false,
            graceDays: 0,
            isActive: activate,
          },
        });
      const activated = activate && cohort.status !== CohortStatus.ACTIVE;
      if (activate) {
        await tx.programme.update({
          where: { id: programme.id },
          data: { status: ProgrammeStatus.ACTIVE },
        });
        await tx.cohort.update({ where: { id: cohort.id }, data: { status: CohortStatus.ACTIVE } });
        await tx.assessmentWindow.updateMany({
          where: { cohortId: cohort.id, formType: ReviewType.MONTHLY, sequence: 1 },
          data: { isActive: true },
        });
      }
      if (!current || created.length || activated)
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            cohortId: cohort.id,
            action: activated ? 'programme_stream.activated' : 'programme_stream.configured',
            entityType: 'Programme',
            entityId: programme.id,
            metadata: {
              startDate: plan.startDate,
              endDate: null,
              languages: ['EN'],
              formIds: created,
              coordinatorUserIds: readers.map((r) => r.id),
              source: 'user-approved 2026/2027 setup',
            },
          },
        });
      return { programmeId: programme.id, cohortId: cohort.id, createdForms: created.length };
    },
    { timeout: 60000 },
  );
  console.log(JSON.stringify(result));
}
main().finally(() => db.$disconnect());
