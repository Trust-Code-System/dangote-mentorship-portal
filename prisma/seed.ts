/**
 * Seed a realistic bilingual demo cohort (CLAUDE.md §3).
 *  - the three roles (Super Admin, Mentor, Mentee) + a Super Admin account
 *  - Programme "BLAK MOH 2026" + an active 2026 cohort
 *  - default matching criteria + a bilingual competency taxonomy
 *  - 15 mentors and 30 mentees, mixed EN/FR, varied departments/competencies
 *  - one mentor import with a few intentionally messy rows for M1's validator
 *
 * Idempotent: safe to run repeatedly. Run with `npm run db:seed`.
 */
import {
  ActionItemStatus,
  AttendanceStatus,
  ClinicStatus,
  CohortStatus,
  CompetencyType,
  GoalStage,
  GoalStatus,
  ImportSourceType,
  MeetingType,
  ImportStatus,
  ImportRowStatus,
  InviteStatus,
  Language,
  MatchingStatus,
  MatchStatus,
  MeetingStatus,
  NewsletterStatus,
  PrismaClient,
  ProgrammeStatus,
  ReviewStatus,
  ReviewType,
  RoleName,
  SupportRequestReason,
  SupportRequestStatus,
  TrainingStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateInviteToken, inviteExpiry } from '../src/lib/auth/invite';
import {
  defaultWindowLabel,
  planAssessmentWindows,
} from '../src/features/assessments/schedule';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe!2026';
const SUPER_ADMIN_EMAIL = (process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@dangote.com').toLowerCase();

const GENERAL_COMPETENCIES = [
  'Leadership',
  'Communication',
  'Strategic Thinking',
  'Stakeholder Management',
  'Decision Making',
  'Emotional Intelligence',
  'Team Building',
  'Time Management',
];

const TECHNICAL_COMPETENCIES = [
  'Process Engineering',
  'Financial Analysis',
  'Supply Chain Optimization',
  'Data Analytics',
  'Project Management',
  'Safety & HSE',
  'Quality Control',
  'Maintenance Engineering',
];

const EN_DEPARTMENTS = ['Cement', 'Sugar', 'Salt', 'Fertilizer', 'Refinery', 'Logistics', 'Finance', 'IT'];
const EN_LOCATIONS = ['Lagos', 'Abuja', 'Kano', 'Ibese', 'Obajana', 'Port Harcourt'];
const FR_LOCATIONS = ['Dakar', 'Douala', 'Abidjan', 'Lomé'];

const FIRST_NAMES = [
  'Aisha', 'Chidi', 'Ngozi', 'Emeka', 'Fatima', 'Tunde', 'Amara', 'Yusuf', 'Zainab', 'Kwame',
  'Adaeze', 'Ibrahim', 'Bola', 'Chinedu', 'Halima', 'Segun', 'Ifeoma', 'Musa', 'Folake', 'Obi',
  'Mariam', 'Uche', 'Sani', 'Blessing', 'Olu', 'Hadiza', 'Kelechi', 'Aminata', 'Femi', 'Grace',
  'Idris', 'Chiamaka', 'Sadio', 'Ousmane', 'Aminu', 'Ngor', 'Mamadou', 'Awa', 'Cheikh', 'Binta',
  'Kofi', 'Esi', 'Yaw', 'Abena', 'Kojo', 'Adwoa',
];
const LAST_NAMES = [
  'Okafor', 'Adeyemi', 'Bello', 'Eze', 'Ogunleye', 'Mohammed', 'Nwosu', 'Diallo', 'Sow', 'Ndiaye',
  'Traoré', 'Koné', 'Mensah', 'Owusu', 'Abubakar', 'Okonkwo', 'Balogun', 'Sani', 'Adeleke', 'Obi',
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

async function hash(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

async function ensureRoles(): Promise<Record<RoleName, string>> {
  const map = {} as Record<RoleName, string>;
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` },
    });
    map[name] = role.id;
  }
  return map;
}

async function ensureUser(opts: {
  email: string;
  name: string;
  locale: Language;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, locale: opts.locale },
    create: {
      email: opts.email,
      name: opts.name,
      locale: opts.locale,
      passwordHash: opts.passwordHash,
      emailVerified: new Date(),
    },
  });
}

async function grantRole(userId: string, roleId: string, cohortId: string | null) {
  // Can't upsert on the compound unique here: cohortId is nullable and Postgres
  // treats NULLs as distinct, so look up explicitly then create/restore.
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId, cohortId } });
  if (existing) {
    if (existing.deletedAt) {
      await prisma.userRole.update({ where: { id: existing.id }, data: { deletedAt: null } });
    }
    return;
  }
  await prisma.userRole.create({ data: { userId, roleId, cohortId } });
}

async function main() {
  console.log('Seeding demo cohort…');
  const passwordHash = await hash(DEFAULT_PASSWORD);
  const roles = await ensureRoles();

  // --- Super Admin (global role grant) ------------------------------------
  const superAdmin = await ensureUser({
    email: SUPER_ADMIN_EMAIL,
    name: 'Super Admin',
    locale: Language.EN,
    passwordHash,
  });
  await grantRole(superAdmin.id, roles.SUPER_ADMIN, null);

  // --- Programme + cohort --------------------------------------------------
  const existingProgramme = await prisma.programme.findFirst({
    where: { name: 'BLAK MOH 2026', deletedAt: null },
  });
  const programme =
    existingProgramme ??
    (await prisma.programme.create({
      data: {
        name: 'BLAK MOH 2026',
        description: 'The 2026 BLAK MOH bilingual (EN/FR) mentorship cohort.',
        status: ProgrammeStatus.ACTIVE,
      },
    }));

  const existingCohort = await prisma.cohort.findFirst({
    where: { programmeId: programme.id, name: 'Cohort 2026 (Jan–Sep)', deletedAt: null },
  });
  const cohort =
    existingCohort ??
    (await prisma.cohort.create({
      data: {
        programmeId: programme.id,
        name: 'Cohort 2026 (Jan–Sep)',
        description: 'January–September 2026 · EN + FR · training batches A/B/C.',
        status: CohortStatus.ACTIVE,
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-09-30'),
        languages: [Language.EN, Language.FR],
        retentionDays: 1095,
      },
    }));

  // --- Default matching criteria (CLAUDE.md §8) ----------------------------
  const criteria = await prisma.matchingCriteria.findFirst({ where: { cohortId: cohort.id } });
  if (!criteria) {
    await prisma.matchingCriteria.create({
      data: {
        cohortId: cohort.id,
        weights: {
          competency: 30,
          careerGoal: 25,
          experience: 20,
          department: 10,
          availability: 10,
          personality: 5,
        },
        hardRules: {
          languageMustMatch: true,
          mentorMustHaveCapacity: true,
          mentorTrainingComplete: true,
          enforceDifferentReportingLine: false,
          enforceNoConflictOfInterest: false,
        },
      },
    });
  }

  // --- Competency taxonomy -------------------------------------------------
  const competencyIds: Record<string, string> = {};
  for (const name of GENERAL_COMPETENCIES) {
    const c = await prisma.competency.upsert({
      where: { cohortId_name_type: { cohortId: cohort.id, name, type: CompetencyType.GENERAL } },
      update: {},
      create: { cohortId: cohort.id, name, type: CompetencyType.GENERAL },
    });
    competencyIds[`G:${name}`] = c.id;
  }
  for (const name of TECHNICAL_COMPETENCIES) {
    const c = await prisma.competency.upsert({
      where: { cohortId_name_type: { cohortId: cohort.id, name, type: CompetencyType.TECHNICAL } },
      update: {},
      create: { cohortId: cohort.id, name, type: CompetencyType.TECHNICAL },
    });
    competencyIds[`T:${name}`] = c.id;
  }

  // --- Training batch so attendance/training-status are demoable -----------
  const batch =
    (await prisma.trainingBatch.findFirst({ where: { cohortId: cohort.id, name: 'Batch A' } })) ??
    (await prisma.trainingBatch.create({
      data: {
        cohortId: cohort.id,
        name: 'Batch A',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-07'),
      },
    }));

  // Captured to build one fully-paired demo relationship below.
  let demoMentorId: string | null = null;
  let demoMenteeId: string | null = null;

  // --- Mentors -------------------------------------------------------------
  const MENTOR_COUNT = 15;
  for (let i = 0; i < MENTOR_COUNT; i++) {
    const isFr = i % 3 === 2; // ~1/3 French speakers
    const locale = isFr ? Language.FR : Language.EN;
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + 3);
    const email = `mentor.${first}.${last}.${i}@dangote.com`.toLowerCase();
    const user = await ensureUser({ email, name: `${first} ${last}`, locale, passwordHash });
    await grantRole(user.id, roles.MENTOR, cohort.id);
    if (i === 0) demoMentorId = user.id; // EN mentor for the demo pair

    // A handful of mentors are left intentionally light on data so the M3 risk
    // monitor and M1 validator have something to flag.
    const sparse = i % 7 === 0;
    const profile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        cohortId: cohort.id,
        fullName: `${first} ${last}`,
        email,
        phone: sparse ? null : `+2348${(10000000 + i).toString().slice(0, 8)}`,
        department: pick(EN_DEPARTMENTS, i),
        jobTitle: 'Senior Manager',
        location: isFr ? pick(FR_LOCATIONS, i) : pick(EN_LOCATIONS, i),
        preferredLanguage: locale,
        yearsExperience: 10 + (i % 12),
        currentRole: 'Senior Manager',
        whyMentor: sparse ? null : 'I want to develop the next generation of Dangote leaders.',
        personality: pick(['Analytical', 'Driver', 'Amiable', 'Expressive'], i),
        whatCanLearn: 'Operational leadership and stakeholder management.',
        maxMentees: 2 + (i % 3),
        trainingStatus: i % 4 === 0 ? TrainingStatus.IN_PROGRESS : TrainingStatus.COMPLETED,
      },
    });

    // Attach 2 general + 1 technical competency.
    const g1 = competencyIds[`G:${pick(GENERAL_COMPETENCIES, i)}`]!;
    const t1 = competencyIds[`T:${pick(TECHNICAL_COMPETENCIES, i)}`]!;
    for (const competencyId of [g1, t1]) {
      const exists = await prisma.profileCompetency.findFirst({
        where: { mentorProfileId: profile.id, competencyId },
      });
      if (!exists) {
        await prisma.profileCompetency.create({
          data: { mentorProfileId: profile.id, competencyId },
        });
      }
    }

    await prisma.trainingAttendance.upsert({
      where: { batchId_userId: { batchId: batch.id, userId: user.id } },
      update: {},
      create: {
        batchId: batch.id,
        userId: user.id,
        status: i % 4 === 0 ? AttendanceStatus.REGISTERED : AttendanceStatus.ATTENDED,
      },
    });
  }

  // --- Mentees -------------------------------------------------------------
  const MENTEE_COUNT = 30;
  for (let i = 0; i < MENTEE_COUNT; i++) {
    const isFr = i % 3 === 1;
    const locale = isFr ? Language.FR : Language.EN;
    const first = pick(FIRST_NAMES, i + 15);
    const last = pick(LAST_NAMES, i + 7);
    const email = `mentee.${first}.${last}.${i}@dangote.com`.toLowerCase();
    const user = await ensureUser({ email, name: `${first} ${last}`, locale, passwordHash });
    await grantRole(user.id, roles.MENTEE, cohort.id);
    if (i === 0) demoMenteeId = user.id; // EN mentee for the demo pair

    const sparse = i % 9 === 0; // a few mentees missing career goals, etc.
    const profile = await prisma.menteeProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        cohortId: cohort.id,
        fullName: `${first} ${last}`,
        email,
        phone: `+2347${(20000000 + i).toString().slice(0, 8)}`,
        department: pick(EN_DEPARTMENTS, i + 2),
        jobTitle: 'Officer',
        location: isFr ? pick(FR_LOCATIONS, i) : pick(EN_LOCATIONS, i),
        preferredLanguage: locale,
        currentGrade: pick(['Officer I', 'Officer II', 'Analyst', 'Associate'], i),
        whyMentor: sparse ? null : 'I want guidance to grow into a leadership role.',
        careerGoals: sparse ? null : 'Move into a managerial role within 18 months.',
        personality: pick(['Analytical', 'Driver', 'Amiable', 'Expressive'], i),
        trainingStatus: i % 5 === 0 ? TrainingStatus.IN_PROGRESS : TrainingStatus.COMPLETED,
      },
    });

    // 1 strength + 2 competencies to strengthen.
    const strength = competencyIds[`G:${pick(GENERAL_COMPETENCIES, i)}`]!;
    const toStrengthen1 = competencyIds[`G:${pick(GENERAL_COMPETENCIES, i + 1)}`]!;
    const toStrengthen2 = competencyIds[`T:${pick(TECHNICAL_COMPETENCIES, i)}`]!;
    const links: Array<{ competencyId: string; isStrength: boolean; isToStrengthen: boolean }> = [
      { competencyId: strength, isStrength: true, isToStrengthen: false },
      { competencyId: toStrengthen1, isStrength: false, isToStrengthen: true },
      { competencyId: toStrengthen2, isStrength: false, isToStrengthen: true },
    ];
    for (const link of links) {
      const exists = await prisma.profileCompetency.findFirst({
        where: { menteeProfileId: profile.id, competencyId: link.competencyId },
      });
      if (!exists) {
        await prisma.profileCompetency.create({ data: { menteeProfileId: profile.id, ...link } });
      }
    }
  }

  // --- A fully-paired demo relationship ------------------------------------
  // One ACCEPTED pair (same language) so agreements (M2) and goals are demoable
  // immediately, plus two sample goals: one awaiting mentor review, one approved
  // and in progress.
  if (demoMentorId && demoMenteeId) {
    await prisma.match.upsert({
      where: {
        cohortId_mentorId_menteeId: {
          cohortId: cohort.id,
          mentorId: demoMentorId,
          menteeId: demoMenteeId,
        },
      },
      update: {},
      create: {
        cohortId: cohort.id,
        mentorId: demoMentorId,
        menteeId: demoMenteeId,
        score: 82,
        status: MatchStatus.ACCEPTED,
        acceptedAt: new Date(),
        approvedById: superAdmin.id,
        aiRationale:
          'Same language: English. Strong competency and experience alignment; availability confirmed.',
      },
    });
    await prisma.mentorProfile.updateMany({
      where: { userId: demoMentorId, cohortId: cohort.id },
      data: { matchingStatus: MatchingStatus.MATCHED },
    });
    await prisma.menteeProfile.updateMany({
      where: { userId: demoMenteeId, cohortId: cohort.id },
      data: { matchingStatus: MatchingStatus.MATCHED },
    });

    const existingGoals = await prisma.goal.count({
      where: { menteeId: demoMenteeId, deletedAt: null },
    });
    if (existingGoals === 0) {
      await prisma.goal.create({
        data: {
          cohortId: cohort.id,
          menteeId: demoMenteeId,
          title: 'Strengthen stakeholder communication',
          competency: 'Communication',
          whyMatters: 'I need to influence senior stakeholders to move into a managerial role.',
          currentLevel: 'I prepare updates but rarely lead the conversation.',
          desiredLevel: 'Confidently lead steering-committee updates.',
          learningActivity: 'Co-present two updates with my mentor and debrief each.',
          successMeasure: 'Deliver a steering-committee update rated positively by my manager.',
          endDate: new Date('2026-08-01'),
          status: GoalStatus.SUBMITTED,
          stage: GoalStage.DRAFTED,
        },
      });
      await prisma.goal.create({
        data: {
          cohortId: cohort.id,
          menteeId: demoMenteeId,
          title: 'Lead a cross-functional cost-saving initiative',
          competency: 'Leadership',
          whyMatters: 'Demonstrates readiness for a team-lead position.',
          currentLevel: 'Contribute to projects but have not led one.',
          desiredLevel: 'Own a small cross-functional initiative end to end.',
          learningActivity: 'Shadow my mentor, then lead a scoped workstream.',
          successMeasure: 'A costed proposal adopted by the department.',
          endDate: new Date('2026-09-15'),
          status: GoalStatus.APPROVED,
          stage: GoalStage.IN_PROGRESS,
          approvedById: demoMentorId,
          approvedAt: new Date(),
        },
      });
    }

    // A sample session log + action items so session logging is demoable.
    const existingLogs = await prisma.sessionLog.count({
      where: { mentorId: demoMentorId, menteeId: demoMenteeId, deletedAt: null },
    });
    if (existingLogs === 0) {
      const log = await prisma.sessionLog.create({
        data: {
          cohortId: cohort.id,
          mentorId: demoMentorId,
          menteeId: demoMenteeId,
          date: new Date('2026-02-12'),
          time: '14:00',
          meetingType: MeetingType.ZOOM,
          competencyDiscussed: 'Communication',
          goalDiscussed: 'Strengthen stakeholder communication',
          discussionSummary:
            'Reviewed how the mentee prepares for steering-committee updates and where confidence drops.',
          aiSummary:
            'Discussed presentation skills, confidence, and stakeholder engagement. The mentee will prepare a short presentation before the next session.',
          actionsAgreed: 'Mentee to draft a 5-minute update; mentor to share a feedback checklist.',
          challenges: 'Mentee finds it hard to field unexpected questions live.',
          nextActionPlan: 'Rehearse the update together and run a mock Q&A.',
          timeline: '2 weeks',
          nextMeetingDate: new Date('2026-02-26'),
        },
      });
      await prisma.actionItem.createMany({
        data: [
          {
            cohortId: cohort.id,
            sessionLogId: log.id,
            createdById: demoMentorId,
            assigneeId: demoMenteeId,
            title: 'Prepare a 5-minute steering-committee update',
            dueDate: new Date('2026-02-24'),
            status: ActionItemStatus.IN_PROGRESS,
          },
          {
            cohortId: cohort.id,
            sessionLogId: log.id,
            createdById: demoMentorId,
            assigneeId: demoMentorId,
            title: 'Share a stakeholder-feedback checklist',
            dueDate: new Date('2026-02-18'),
            status: ActionItemStatus.OPEN,
          },
        ],
      });
    }

    // Reflection journal (§1.16): one private entry + one the mentee has shared.
    const existingReflections = await prisma.reflectionJournalEntry.count({
      where: { authorId: demoMenteeId, deletedAt: null },
    });
    if (existingReflections === 0) {
      await prisma.reflectionJournalEntry.create({
        data: {
          cohortId: cohort.id,
          authorId: demoMenteeId,
          title: 'After my first session',
          body: 'I learned that I freeze when questions come out of order. I will rehearse a mock Q&A so I feel ready next time.',
          bodyLang: Language.EN,
          isSharedWithMentor: true,
          sharedAt: new Date('2026-02-13'),
        },
      });
      await prisma.reflectionJournalEntry.create({
        data: {
          cohortId: cohort.id,
          authorId: demoMenteeId,
          title: 'Private note to self',
          body: 'Still nervous about presenting to senior leaders — keeping this one to myself for now.',
          bodyLang: Language.EN,
          isSharedWithMentor: false,
        },
      });
    }

    // Mentor private note (§1.16): visible only to the mentor.
    const existingNotes = await prisma.mentorPrivateNote.count({
      where: { mentorId: demoMentorId, menteeId: demoMenteeId, deletedAt: null },
    });
    if (existingNotes === 0) {
      await prisma.mentorPrivateNote.create({
        data: {
          cohortId: cohort.id,
          mentorId: demoMentorId,
          menteeId: demoMenteeId,
          kind: 'growth',
          body: 'Strong analytical thinker; main growth area is composure under live questioning. Pair her with a clinic on executive presence.',
          bodyLang: Language.EN,
        },
      });
    }

    // One open support request (§1.13) so the admin queue is demoable.
    const existingSupport = await prisma.supportRequest.count({
      where: { requesterId: demoMenteeId, deletedAt: null },
    });
    if (existingSupport === 0) {
      await prisma.supportRequest.create({
        data: {
          cohortId: cohort.id,
          requesterId: demoMenteeId,
          reason: SupportRequestReason.NEED_GOAL_HELP,
          message: 'I would like a second opinion on whether my goals are ambitious enough.',
          status: SupportRequestStatus.OPEN,
        },
      });
    }

    // A couple of notifications (§1.10) so the inbox + unread badge are demoable.
    const existingNotifications = await prisma.notification.count({
      where: { userId: demoMenteeId, deletedAt: null },
    });
    if (existingNotifications === 0) {
      await prisma.notification.createMany({
        data: [
          {
            userId: demoMenteeId,
            cohortId: cohort.id,
            type: 'goal_commented',
            title: 'Goal feedback from your mentor',
            body: 'Your mentor reviewed your goal “Strengthen stakeholder communication”.',
            link: '/goals',
            emailPending: true,
          },
          {
            userId: demoMenteeId,
            cohortId: cohort.id,
            type: 'meeting_scheduled',
            title: 'New session scheduled',
            body: 'Your mentor scheduled “Monthly mentoring session” for 2026-06-20.',
            link: '/meetings',
            readAt: new Date('2026-06-09'),
            emailedAt: new Date('2026-06-09'),
          },
        ],
      });
    }

    // Sample meetings: one upcoming, one past awaiting no-show confirmation.
    const existingMeetings = await prisma.meeting.count({
      where: { mentorId: demoMentorId, menteeId: demoMenteeId, deletedAt: null },
    });
    if (existingMeetings === 0) {
      await prisma.meeting.createMany({
        data: [
          {
            cohortId: cohort.id,
            organizerId: demoMentorId,
            mentorId: demoMentorId,
            menteeId: demoMenteeId,
            title: 'Monthly mentoring session',
            type: MeetingType.ZOOM,
            startsAt: new Date('2026-06-20T14:00:00Z'),
            endsAt: new Date('2026-06-20T15:00:00Z'),
            status: MeetingStatus.SCHEDULED,
          },
          {
            cohortId: cohort.id,
            organizerId: demoMentorId,
            mentorId: demoMentorId,
            menteeId: demoMenteeId,
            title: 'Kick-off session',
            type: MeetingType.PHYSICAL,
            startsAt: new Date('2026-02-12T14:00:00Z'),
            endsAt: new Date('2026-02-12T15:00:00Z'),
            status: MeetingStatus.SCHEDULED,
          },
        ],
      });
    }
  }

  // --- A published mid-term review form so the fill flow is demoable -------
  // Editable form_definition (no code change to alter the questions). Bilingual
  // (EN/FR) per CLAUDE.md §6; role-agnostic so both mentor and mentee fill it.
  const existingMidtermForm = await prisma.formDefinition.findFirst({
    where: { cohortId: cohort.id, type: ReviewType.MIDTERM, deletedAt: null },
  });
  if (!existingMidtermForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.MIDTERM,
        roleName: null,
        title: 'Mid-term mentorship review',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'met_regularly',
              labelEn: 'Have you and your partner been meeting regularly?',
              labelFr: 'Vous et votre binôme vous êtes-vous rencontrés régulièrement ?',
              type: 'boolean',
              required: true,
            },
            {
              id: 'progress_rating',
              labelEn: 'How would you rate progress toward the goals so far?',
              labelFr: 'Comment évaluez-vous les progrès vers les objectifs jusqu’ici ?',
              type: 'rating',
              required: true,
              max: 5,
            },
            {
              id: 'usefulness',
              labelEn: 'How useful has the mentorship been?',
              labelFr: 'Dans quelle mesure le mentorat a-t-il été utile ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'very', labelEn: 'Very useful', labelFr: 'Très utile' },
                { value: 'somewhat', labelEn: 'Somewhat useful', labelFr: 'Assez utile' },
                { value: 'not', labelEn: 'Not useful yet', labelFr: 'Pas encore utile' },
              ],
            },
            {
              id: 'highlights',
              labelEn: 'What has gone well so far?',
              labelFr: 'Qu’est-ce qui s’est bien passé jusqu’ici ?',
              type: 'long_text',
              required: false,
            },
            {
              id: 'support_needed',
              labelEn: 'What support do you need for the second half?',
              labelFr: 'De quel soutien avez-vous besoin pour la seconde moitié ?',
              type: 'long_text',
              required: false,
            },
          ],
        },
      },
    });
  }

  // --- A published final review form so the fill flow is demoable ----------
  const existingFinalForm = await prisma.formDefinition.findFirst({
    where: { cohortId: cohort.id, type: ReviewType.FINAL, deletedAt: null },
  });
  if (!existingFinalForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.FINAL,
        roleName: null,
        title: 'Final mentorship review',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'goals_achieved',
              labelEn: 'Were your mentorship goals achieved?',
              labelFr: 'Vos objectifs de mentorat ont-ils été atteints ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'fully', labelEn: 'Fully', labelFr: 'Entièrement' },
                { value: 'partly', labelEn: 'Partly', labelFr: 'En partie' },
                { value: 'not', labelEn: 'Not really', labelFr: 'Pas vraiment' },
              ],
            },
            {
              id: 'overall_rating',
              labelEn: 'Overall, how would you rate the mentorship experience?',
              labelFr: 'Dans l’ensemble, comment évaluez-vous l’expérience de mentorat ?',
              type: 'rating',
              required: true,
              max: 5,
            },
            {
              id: 'biggest_change',
              labelEn: 'What is the biggest change you saw over the programme?',
              labelFr: 'Quel est le plus grand changement observé pendant le programme ?',
              type: 'long_text',
              required: true,
            },
            {
              id: 'would_recommend',
              labelEn: 'Would you recommend the programme to a colleague?',
              labelFr: 'Recommanderiez-vous le programme à un collègue ?',
              type: 'boolean',
              required: true,
            },
            {
              id: 'suggestions',
              labelEn: 'What would you improve for the next cohort?',
              labelFr: 'Qu’amélioreriez-vous pour la prochaine cohorte ?',
              type: 'long_text',
              required: false,
            },
          ],
        },
      },
    });
  }

  // --- The mandatory quarterly assessment: form + schedule ----------------
  // Mentees must submit one of these every 3 months or the portal locks for
  // them (features/assessments). Mentee-specific question set, bilingual.
  const existingQuarterlyForm = await prisma.formDefinition.findFirst({
    where: { cohortId: cohort.id, type: ReviewType.QUARTERLY, deletedAt: null },
  });
  if (!existingQuarterlyForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.QUARTERLY,
        roleName: RoleName.MENTEE,
        title: 'Quarterly mentee assessment',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'sessions_held',
              labelEn: 'How many mentoring sessions did you hold this quarter?',
              labelFr: 'Combien de séances de mentorat avez-vous tenues ce trimestre ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'none', labelEn: 'None', labelFr: 'Aucune' },
                { value: 'one', labelEn: 'One', labelFr: 'Une' },
                { value: 'two_three', labelEn: 'Two or three', labelFr: 'Deux ou trois' },
                { value: 'four_plus', labelEn: 'Four or more', labelFr: 'Quatre ou plus' },
              ],
            },
            {
              id: 'goal_progress',
              labelEn: 'How far have you progressed against your current goals?',
              labelFr: 'Où en êtes-vous par rapport à vos objectifs actuels ?',
              type: 'rating',
              required: true,
              max: 5,
            },
            {
              id: 'competency_gained',
              labelEn: 'Which competency did you strengthen most this quarter?',
              labelFr: 'Quelle compétence avez-vous le plus renforcée ce trimestre ?',
              type: 'short_text',
              required: true,
            },
            {
              id: 'applied_at_work',
              labelEn: 'Give one example of applying what you learned at work.',
              labelFr: 'Donnez un exemple concret d’application de vos acquis au travail.',
              type: 'long_text',
              required: true,
            },
            {
              id: 'blockers',
              labelEn: 'What is getting in the way of your development?',
              labelFr: 'Qu’est-ce qui freine votre développement ?',
              type: 'long_text',
              required: false,
            },
            {
              id: 'relationship_working',
              labelEn: 'Is the mentoring relationship working for you?',
              labelFr: 'La relation de mentorat vous convient-elle ?',
              type: 'boolean',
              required: true,
            },
          ],
        },
      },
    });
  }

  // Schedule: one assessment every 3 months from the cohort start date. The
  // planner is pure and shared with the admin "generate schedule" action, so
  // the demo cohort and a real cohort get an identical cadence.
  const existingWindows = await prisma.assessmentWindow.findMany({
    where: { cohortId: cohort.id, deletedAt: null },
    select: { sequence: true },
  });
  if (cohort.startDate) {
    const taken = new Set(existingWindows.map((w) => w.sequence));
    const plans = planAssessmentWindows({
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      intervalMonths: cohort.assessmentIntervalMonths,
    }).filter((plan) => !taken.has(plan.sequence));

    if (plans.length > 0) {
      await prisma.assessmentWindow.createMany({
        data: plans.map((plan) => ({
          cohortId: cohort.id,
          sequence: plan.sequence,
          label: defaultWindowLabel(plan),
          opensAt: plan.opensAt,
          dueAt: plan.dueAt,
          graceDays: cohort.assessmentGraceDays,
        })),
      });
    }
  }

  // Past-due windows are pre-submitted for almost every mentee, so seeding the
  // schedule doesn't lock the whole demo cohort out of the portal. Two mentees
  // are deliberately left outstanding so the admin completion table (and the
  // lockout itself) is demoable on real data.
  const quarterlyForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.QUARTERLY,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const pastWindows = await prisma.assessmentWindow.findMany({
    where: { cohortId: cohort.id, isActive: true, deletedAt: null, dueAt: { lte: new Date() } },
    select: { id: true },
  });
  if (quarterlyForm && pastWindows.length > 0) {
    const menteeGrants = await prisma.userRole.findMany({
      where: { cohortId: cohort.id, deletedAt: null, roleId: roles.MENTEE },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const menteeIds = Array.from(new Set(menteeGrants.map((g) => g.userId)));
    // Leave the last two outstanding: one in grace / one locked out.
    const compliant = menteeIds.slice(0, Math.max(0, menteeIds.length - 2));

    for (const window of pastWindows) {
      const already = await prisma.formResponse.findMany({
        where: { assessmentWindowId: window.id, deletedAt: null },
        select: { respondentId: true },
      });
      const done = new Set(already.map((r) => r.respondentId));
      const todo = compliant.filter((id) => !done.has(id));
      if (todo.length === 0) continue;

      await prisma.formResponse.createMany({
        data: todo.map((userId, idx) => ({
          formId: quarterlyForm.id,
          respondentId: userId,
          assessmentWindowId: window.id,
          status: ReviewStatus.SUBMITTED,
          submittedAt: new Date(),
          answers: {
            sessions_held: idx % 3 === 0 ? 'four_plus' : 'two_three',
            goal_progress: 3 + (idx % 3),
            competency_gained: 'Stakeholder management',
            applied_at_work: 'Led the weekly production review for my unit.',
            blockers: idx % 5 === 0 ? 'Hard to find time with shift work.' : null,
            relationship_working: true,
          },
        })),
      });
    }
  }

  // --- Newsletter cadence + a draft waiting for review --------------------
  // Twice a week (Monday + Thursday, 09:00 Lagos) is how the programme runs it.
  // The schedule prepares drafts; sending stays a human action.
  await prisma.newsletterSchedule.upsert({
    where: { cohortId: cohort.id },
    update: {},
    create: {
      cohortId: cohort.id,
      enabled: true,
      sendDays: [1, 4],
      sendHour: 9,
      timezone: 'Africa/Lagos',
      autoDraft: true,
    },
  });

  const existingNewsletter = await prisma.newsletter.findFirst({
    where: { cohortId: cohort.id, deletedAt: null },
    select: { id: true },
  });
  if (!existingNewsletter) {
    await prisma.newsletter.create({
      data: {
        cohortId: cohort.id,
        createdById: superAdmin.id,
        title: 'Newsletter — sample issue',
        subjectEn: 'Four goals approved and a clinic on Thursday',
        subjectFr: 'Quatre objectifs approuvés et une clinique jeudi',
        status: NewsletterStatus.DRAFT,
        bodyJson: {
          sections: [
            {
              kind: 'intro',
              headingEn: 'This week in the programme',
              headingFr: 'Cette semaine dans le programme',
              bodyEn:
                'A steady week: more pairs are meeting on schedule and the first goals of the quarter are through approval.',
              bodyFr:
                'Une semaine régulière : davantage de binômes se rencontrent comme prévu et les premiers objectifs du trimestre sont approuvés.',
              enabled: true,
            },
            {
              kind: 'highlights',
              headingEn: 'Highlights',
              headingFr: 'Points forts',
              bodyEn: [
                'Four goals were approved by mentors.',
                'Twelve sessions were logged across the cohort.',
                'The French-speaking pairs held their first joint session.',
              ].join('\n'),
              bodyFr: [
                'Quatre objectifs ont été approuvés par les mentors.',
                'Douze séances ont été consignées dans la cohorte.',
                'Les binômes francophones ont tenu leur première séance commune.',
              ].join('\n'),
              enabled: true,
            },
            {
              kind: 'numbers',
              headingEn: 'By the numbers',
              headingFr: 'En chiffres',
              bodyEn: ['Goals approved: 4', 'Sessions logged: 12', 'Pairs that met: 11 of 20'].join(
                '\n',
              ),
              bodyFr: [
                'Objectifs approuvés : 4',
                'Séances consignées : 12',
                'Binômes qui se sont rencontrés : 11 sur 20',
              ].join('\n'),
              enabled: true,
            },
            {
              kind: 'dates',
              headingEn: 'Dates to remember',
              headingFr: 'Dates à retenir',
              bodyEn: 'Quarterly assessment — due at the end of the month',
              bodyFr: 'Évaluation trimestrielle — à rendre à la fin du mois',
              enabled: true,
            },
            {
              kind: 'spotlight',
              headingEn: 'Spotlight',
              headingFr: 'Coup de projecteur',
              bodyEn: '',
              bodyFr: '',
              enabled: false,
            },
            {
              kind: 'callToAction',
              headingEn: 'What to do next',
              headingFr: 'Prochaine étape',
              bodyEn:
                'If you have not logged your last session, add it this week so your mentor can comment on it.',
              bodyFr:
                'Si vous n’avez pas consigné votre dernière séance, ajoutez-la cette semaine pour que votre mentor puisse la commenter.',
              enabled: true,
            },
          ],
        },
      },
    });
  }

  // --- A messy mentor import for the M1 validator to catch -----------------
  const existingImport = await prisma.import.findFirst({
    where: { cohortId: cohort.id, fileName: 'mentors-batch-2026.csv' },
  });
  if (!existingImport) {
    const messyRows = [
      // missing email
      { 'Full Name': 'Grace Eze', Email: '', Language: 'EN', Department: 'Cement' },
      // invalid email + no language
      { 'Full Name': 'Paul Adeyemi', Email: 'paul(at)dangote.com', Language: '', Department: 'Sugar' },
      // duplicate of a seeded mentor
      { 'Full Name': 'Aisha Eze', Email: 'mentor.aisha.eze.0@dangote.com', Language: 'EN', Department: 'Cement' },
      // 20 years experience but no competency area
      { 'Full Name': 'Sani Bello', Email: 'sani.bello@dangote.com', Language: 'FR', Department: '', Experience: '20 years', Competencies: '' },
      // no name
      { 'Full Name': '', Email: 'unknown@dangote.com', Language: 'EN', Department: 'Logistics' },
    ];
    const imp = await prisma.import.create({
      data: {
        cohortId: cohort.id,
        uploadedById: superAdmin.id,
        fileName: 'mentors-batch-2026.csv',
        sourceType: ImportSourceType.CSV,
        status: ImportStatus.PENDING,
        targetRole: RoleName.MENTOR,
        rowCount: messyRows.length,
      },
      });
    await prisma.importRow.createMany({
      data: messyRows.map((raw, idx) => ({
        importId: imp.id,
        rowNumber: idx + 1,
        raw,
        status: ImportRowStatus.PENDING,
      })),
    });
  }

  // --- A pending invite so the invite flow is demoable ----------------------
  const inviteEmail = 'invited.mentor@dangote.com';
  const existingInvite = await prisma.invite.findFirst({
    where: { email: inviteEmail, status: InviteStatus.PENDING, deletedAt: null },
  });
  if (!existingInvite) {
    const { token, tokenHash } = generateInviteToken();
    await prisma.invite.create({
      data: {
        email: inviteEmail,
        roleName: RoleName.MENTOR,
        cohortId: cohort.id,
        tokenHash,
        expiresAt: inviteExpiry(),
        invitedById: superAdmin.id,
      },
    });
    console.log(`  Demo invite (mentor): /invite/${token}`);
  }

  // --- Engagement content: cohort resources + an upcoming clinic ------------
  // So the mentee dashboard's "New resources" and "Upcoming clinic" cards render
  // from real records. Insert-if-empty so re-seeding stays idempotent.
  if ((await prisma.resource.count({ where: { cohortId: cohort.id, deletedAt: null } })) === 0) {
    await prisma.resource.createMany({
      data: [
        { cohortId: cohort.id, title: '2026 Strategy Playbook', category: 'Guide', lang: Language.EN, url: 'https://example.com/resources/strategy-playbook.pdf' },
        { cohortId: cohort.id, title: 'Managing Upwards', category: 'Video', lang: Language.EN, url: 'https://example.com/resources/managing-upwards' },
        { cohortId: cohort.id, title: 'Donner un feedback efficace', category: 'Article', lang: Language.FR, url: 'https://example.com/resources/feedback-efficace' },
      ],
    });
  }
  const hasUpcomingClinic = await prisma.clinic.count({
    where: { cohortId: cohort.id, deletedAt: null, status: ClinicStatus.SCHEDULED, scheduledAt: { gte: new Date() } },
  });
  if (hasUpcomingClinic === 0) {
    const friday = new Date();
    friday.setUTCHours(16, 0, 0, 0);
    friday.setUTCDate(friday.getUTCDate() + (((5 - friday.getUTCDay() + 7) % 7) || 7));
    await prisma.clinic.create({
      data: {
        cohortId: cohort.id,
        title: 'Leadership in Chaos',
        topic: 'Crisis management and rapid scaling',
        scheduledAt: friday,
        joinUrl: 'https://example.com/clinics/leadership-in-chaos',
        status: ClinicStatus.SCHEDULED,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  Super Admin:    ${SUPER_ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
  console.log('  Programme Admin: prog.admin@dangote.com');
  console.log('  Trainer:         trainer@dangote.com');
  console.log('  Reviewer:        reviewer@dangote.com');
  console.log(`  Mentors: ${MENTOR_COUNT} · Mentees: ${MENTEE_COUNT} (all password: ${DEFAULT_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
