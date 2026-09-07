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
  defaultMonthlyWindowLabel,
  defaultWindowLabel,
  planAssessmentWindows,
  planMonthlyWindows,
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

  // --- The mandatory quarterly assessment: forms + schedule ---------------
  // Transcribed from the programme's mid-point assessment documents. There are
  // TWO question sets — mentors and mentees are asked different things — and
  // both sides are held to it: missing it past the grace window blocks the
  // portal for either role (features/assessments/participants.ts).
  //
  // Full name / date / batch are not asked: the response is already tied to the
  // signed-in participant and their cohort.
  const MENTEE_FREQUENCY_OPTIONS = [
    { value: 'weekly', labelEn: 'Weekly', labelFr: 'Chaque semaine' },
    { value: 'biweekly', labelEn: 'Biweekly', labelFr: 'Toutes les deux semaines' },
    { value: 'monthly', labelEn: 'Monthly', labelFr: 'Chaque mois' },
    { value: 'less_often', labelEn: 'Less frequently', labelFr: 'Moins souvent' },
  ];

  const PROGRESS_OPTIONS = [
    { value: 'significant', labelEn: 'Significant progress', labelFr: 'Progrès importants' },
    { value: 'some', labelEn: 'Some progress', labelFr: 'Quelques progrès' },
    { value: 'limited', labelEn: 'Limited progress', labelFr: 'Progrès limités' },
    { value: 'none', labelEn: 'No progress', labelFr: 'Aucun progrès' },
  ];

  const existingQuarterlyForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.QUARTERLY,
      roleName: RoleName.MENTEE,
      deletedAt: null,
    },
  });
  if (!existingQuarterlyForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.QUARTERLY,
        roleName: RoleName.MENTEE,
        title: 'Quarterly assessment — mentee',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'meet_frequency',
              labelEn: 'How often do you meet or interact with your mentor?',
              labelFr: 'À quelle fréquence rencontrez-vous ou échangez-vous avec votre mentor ?',
              type: 'single_select',
              required: true,
              options: MENTEE_FREQUENCY_OPTIONS,
            },
            {
              id: 'relationship_quality',
              labelEn: 'How would you rate your relationship with your mentor?',
              labelFr: 'Comment évaluez-vous votre relation avec votre mentor ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'very_supportive', labelEn: 'Very supportive', labelFr: 'Très soutenante' },
                { value: 'supportive', labelEn: 'Supportive', labelFr: 'Soutenante' },
                { value: 'neutral', labelEn: 'Neutral', labelFr: 'Neutre' },
                { value: 'unsupportive', labelEn: 'Unsupportive', labelFr: 'Peu soutenante' },
              ],
            },
            {
              id: 'goal_clarity',
              labelEn: "How clear are the goals you're working on with your mentor?",
              labelFr: 'Les objectifs que vous poursuivez avec votre mentor sont-ils clairs ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'very_clear', labelEn: 'Very clear', labelFr: 'Très clairs' },
                { value: 'clear', labelEn: 'Clear', labelFr: 'Clairs' },
                { value: 'somewhat_clear', labelEn: 'Somewhat clear', labelFr: 'Plutôt clairs' },
                { value: 'not_clear', labelEn: 'Not clear', labelFr: 'Pas clairs' },
              ],
            },
            {
              id: 'goal_progress',
              labelEn: 'Have you made progress on your mentorship goals so far?',
              labelFr: 'Avez-vous progressé vers vos objectifs de mentorat jusqu’ici ?',
              type: 'single_select',
              required: true,
              options: PROGRESS_OPTIONS,
            },
            {
              id: 'what_helped_most',
              labelEn: 'What has helped you the most in this mentorship process?',
              labelFr: 'Qu’est-ce qui vous a le plus aidé dans ce processus de mentorat ?',
              type: 'long_text',
              required: true,
            },
            {
              id: 'difficulties',
              labelEn: 'What has made achieving your goals difficult? Tick all that apply.',
              labelFr:
                'Qu’est-ce qui a rendu difficile l’atteinte de vos objectifs ? Cochez tout ce qui s’applique.',
              type: 'multi_select',
              required: false,
              options: [
                { value: 'time', labelEn: 'Time constraints', labelFr: 'Manque de temps' },
                {
                  value: 'communication',
                  labelEn: 'Lack of communication',
                  labelFr: 'Manque de communication',
                },
                {
                  value: 'expectations',
                  labelEn: 'Unclear expectations',
                  labelFr: 'Attentes floues',
                },
                { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
              ],
            },
            {
              id: 'difficulties_other',
              labelEn: 'If you ticked "something else" above, please say what',
              labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
              type: 'short_text',
              required: false,
            },
            {
              id: 'support_needed',
              labelEn:
                'What kind of support do you need to move forward more effectively? Tick all that apply.',
              labelFr:
                'De quel type de soutien avez-vous besoin pour avancer plus efficacement ? Cochez tout ce qui s’applique.',
              type: 'multi_select',
              required: true,
              options: [
                {
                  value: 'mentor_engagement',
                  labelEn: 'More engagement with my mentor',
                  labelFr: 'Plus d’échanges avec mon mentor',
                },
                { value: 'goal_refinement', labelEn: 'Goal refinement', labelFr: 'Affiner les objectifs' },
                {
                  value: 'coordinator_checkins',
                  labelEn: 'More programme coordinator check-ins',
                  labelFr: 'Plus de points avec la coordination du programme',
                },
                {
                  value: 'peer_support',
                  labelEn: 'Peer support or resources',
                  labelFr: 'Soutien des pairs ou ressources',
                },
                { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
              ],
            },
            {
              id: 'support_needed_other',
              labelEn: 'If you ticked "something else" above, please say what',
              labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
              type: 'short_text',
              required: false,
            },
            {
              id: 'improvement_suggestions',
              labelEn:
                'What could improve the mentoring experience for the rest of the programme?',
              labelFr:
                'Qu’est-ce qui pourrait améliorer l’expérience de mentorat pour le reste du programme ?',
              type: 'long_text',
              required: false,
            },
          ],
        },
      },
    });
  }

  const existingMentorQuarterlyForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.QUARTERLY,
      roleName: RoleName.MENTOR,
      deletedAt: null,
    },
  });
  if (!existingMentorQuarterlyForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.QUARTERLY,
        roleName: RoleName.MENTOR,
        title: 'Quarterly assessment — mentor',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'meeting_number',
              labelEn: 'Meeting number',
              labelFr: 'Numéro de la rencontre',
              type: 'short_text',
              required: false,
            },
            {
              id: 'meeting_duration',
              labelEn: 'Typical duration of your meetings',
              labelFr: 'Durée habituelle de vos rencontres',
              type: 'short_text',
              required: false,
            },
            {
              id: 'meet_frequency',
              labelEn: 'How often have you met with your mentee so far?',
              labelFr: 'À quelle fréquence avez-vous rencontré votre mentoré jusqu’ici ?',
              type: 'single_select',
              required: true,
              options: MENTEE_FREQUENCY_OPTIONS,
            },
            {
              id: 'interaction_quality',
              labelEn: 'How would you describe the quality of your interactions with your mentee?',
              labelFr: 'Comment décririez-vous la qualité de vos échanges avec votre mentoré ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'excellent', labelEn: 'Excellent', labelFr: 'Excellente' },
                { value: 'good', labelEn: 'Good', labelFr: 'Bonne' },
                { value: 'fair', labelEn: 'Fair', labelFr: 'Passable' },
                { value: 'poor', labelEn: 'Poor', labelFr: 'Faible' },
              ],
            },
            {
              id: 'mentee_engagement',
              labelEn: 'How engaged is your mentee in the process?',
              labelFr: 'Dans quelle mesure votre mentoré s’investit-il dans le processus ?',
              type: 'single_select',
              required: true,
              options: [
                { value: 'highly', labelEn: 'Highly engaged', labelFr: 'Très investi' },
                { value: 'moderately', labelEn: 'Moderately engaged', labelFr: 'Moyennement investi' },
                { value: 'minimally', labelEn: 'Minimally engaged', labelFr: 'Peu investi' },
                { value: 'not', labelEn: 'Not engaged', labelFr: 'Pas investi' },
              ],
            },
            {
              id: 'goals_focused',
              labelEn: 'What goals have you and your mentee focused on?',
              labelFr: 'Sur quels objectifs vous êtes-vous concentrés avec votre mentoré ?',
              type: 'long_text',
              required: true,
            },
            {
              id: 'mentee_progress',
              labelEn: 'What progress (if any) has your mentee made toward those goals?',
              labelFr: 'Quels progrès votre mentoré a-t-il réalisés vers ces objectifs, le cas échéant ?',
              type: 'single_select',
              required: true,
              options: PROGRESS_OPTIONS,
            },
            {
              id: 'progress_drivers',
              labelEn: 'In your view, what has contributed most to the progress or lack thereof?',
              labelFr: 'Selon vous, qu’est-ce qui explique le plus ces progrès ou leur absence ?',
              type: 'long_text',
              required: true,
            },
            {
              id: 'had_challenges',
              labelEn: 'Have you encountered any challenges as a mentor in this programme?',
              labelFr: 'Avez-vous rencontré des difficultés en tant que mentor dans ce programme ?',
              type: 'boolean',
              required: true,
            },
            {
              id: 'challenges_detail',
              labelEn: 'If yes, please describe briefly',
              labelFr: 'Si oui, décrivez brièvement',
              type: 'long_text',
              required: false,
            },
            {
              id: 'support_wanted',
              labelEn:
                'What additional support or resources would enhance your mentoring experience? Tick all that apply.',
              labelFr:
                'Quel soutien ou quelles ressources supplémentaires amélioreraient votre expérience de mentor ? Cochez tout ce qui s’applique.',
              type: 'multi_select',
              required: false,
              options: [
                { value: 'peer_support', labelEn: 'Peer support', labelFr: 'Soutien des pairs' },
                {
                  value: 'templates',
                  labelEn: 'More structured templates',
                  labelFr: 'Des modèles plus structurés',
                },
                {
                  value: 'coordinator_guidance',
                  labelEn: 'Guidance from programme coordinators',
                  labelFr: 'Accompagnement de la coordination du programme',
                },
                {
                  value: 'skill_materials',
                  labelEn: 'Skill-building materials',
                  labelFr: 'Supports de développement de compétences',
                },
                { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
              ],
            },
            {
              id: 'support_wanted_other',
              labelEn: 'If you ticked "something else" above, please say what',
              labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
              type: 'short_text',
              required: false,
            },
            {
              id: 'programme_suggestions',
              labelEn: 'What changes, if any, would you recommend to improve the programme?',
              labelFr: 'Quels changements recommanderiez-vous, le cas échéant, pour améliorer le programme ?',
              type: 'long_text',
              required: false,
            },
            {
              id: 'additional_comments',
              labelEn: 'Additional comments',
              labelFr: 'Commentaires supplémentaires',
              type: 'long_text',
              required: false,
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
    where: { cohortId: cohort.id, formType: ReviewType.QUARTERLY, deletedAt: null },
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
          formType: ReviewType.QUARTERLY,
          gatesAccess: true,
          sequence: plan.sequence,
          label: defaultWindowLabel(plan),
          opensAt: plan.opensAt,
          dueAt: plan.dueAt,
          graceDays: cohort.assessmentGraceDays,
        })),
      });
    }
  }

  // Past-due windows are pre-submitted for almost everyone, so seeding the
  // schedule doesn't lock the whole demo cohort out of the portal. A couple of
  // mentees and one mentor are deliberately left outstanding so the admin
  // completion table — and the lockout itself — are demoable on real data.
  const quarterlyMenteeForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.QUARTERLY,
      roleName: RoleName.MENTEE,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const quarterlyMentorForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.QUARTERLY,
      roleName: RoleName.MENTOR,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const pastWindows = await prisma.assessmentWindow.findMany({
    where: {
      cohortId: cohort.id,
      formType: ReviewType.QUARTERLY,
      isActive: true,
      deletedAt: null,
      dueAt: { lte: new Date() },
    },
    select: { id: true },
  });

  if (quarterlyMenteeForm && quarterlyMentorForm && pastWindows.length > 0) {
    const [menteeGrants, mentorGrants] = await Promise.all([
      prisma.userRole.findMany({
        where: { cohortId: cohort.id, deletedAt: null, roleId: roles.MENTEE },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      }),
      prisma.userRole.findMany({
        where: { cohortId: cohort.id, deletedAt: null, roleId: roles.MENTOR },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      }),
    ]);

    const menteeIds = Array.from(new Set(menteeGrants.map((g) => g.userId)));
    const mentorIds = Array.from(new Set(mentorGrants.map((g) => g.userId)));
    // Leave the last two mentees and the last mentor outstanding: one of each
    // in grace, one locked out.
    const compliantMentees = menteeIds.slice(0, Math.max(0, menteeIds.length - 2));
    const compliantMentors = mentorIds.slice(0, Math.max(0, mentorIds.length - 1));

    for (const window of pastWindows) {
      const already = await prisma.formResponse.findMany({
        where: { assessmentWindowId: window.id, deletedAt: null },
        select: { respondentId: true },
      });
      const done = new Set(already.map((r) => r.respondentId));

      const menteeTodo = compliantMentees.filter((id) => !done.has(id));
      if (menteeTodo.length > 0) {
        await prisma.formResponse.createMany({
          data: menteeTodo.map((userId, idx) => ({
            formId: quarterlyMenteeForm.id,
            respondentId: userId,
            assessmentWindowId: window.id,
            status: ReviewStatus.SUBMITTED,
            submittedAt: new Date(),
            answers: {
              meet_frequency: ['biweekly', 'monthly', 'weekly'][idx % 3],
              relationship_quality: idx % 5 === 0 ? 'supportive' : 'very_supportive',
              goal_clarity: idx % 4 === 0 ? 'somewhat_clear' : 'clear',
              goal_progress: ['significant', 'some', 'some', 'limited'][idx % 4],
              what_helped_most:
                'Having someone senior talk through a real decision with me before I made it.',
              // A multi_select answer is stored as a list of option values.
              difficulties: idx % 3 === 0 ? ['time'] : ['time', 'expectations'],
              difficulties_other: null,
              support_needed:
                idx % 2 === 0
                  ? ['mentor_engagement', 'goal_refinement']
                  : ['peer_support'],
              support_needed_other: null,
              improvement_suggestions:
                idx % 6 === 0 ? 'A shared calendar would make scheduling easier.' : null,
            },
          })),
        });
      }

      const mentorTodo = compliantMentors.filter((id) => !done.has(id));
      if (mentorTodo.length > 0) {
        await prisma.formResponse.createMany({
          data: mentorTodo.map((userId, idx) => ({
            formId: quarterlyMentorForm.id,
            respondentId: userId,
            assessmentWindowId: window.id,
            status: ReviewStatus.SUBMITTED,
            submittedAt: new Date(),
            answers: {
              meeting_number: String(idx + 2),
              meeting_duration: '60 minutes',
              meet_frequency: idx % 2 === 0 ? 'biweekly' : 'monthly',
              interaction_quality: ['excellent', 'good', 'good', 'fair'][idx % 4],
              mentee_engagement: ['highly', 'moderately', 'highly', 'minimally'][idx % 4],
              goals_focused:
                'Stakeholder management, and preparing to present to the operations board.',
              mentee_progress: ['significant', 'some', 'some', 'limited'][idx % 4],
              progress_drivers:
                'Consistent meetings and a willingness to try things between sessions.',
              had_challenges: idx % 3 === 0,
              challenges_detail:
                idx % 3 === 0 ? 'Hard to find a slot that works across shift patterns.' : null,
              support_wanted: idx % 2 === 0 ? ['templates', 'peer_support'] : ['skill_materials'],
              support_wanted_other: null,
              programme_suggestions:
                idx % 5 === 0 ? 'A short refresher for mentors at the halfway point.' : null,
              additional_comments: null,
            },
          })),
        });
      }
    }
  }

  // --- The monthly meeting form (mentees only, never gates access) ---------
  // Transcribed from the programme's "Monthly Meeting Form" document. Name,
  // email and batch are deliberately NOT asked: the response is already tied to
  // the signed-in mentee and their cohort, so re-typing them monthly would only
  // add friction and a chance to mistype.
  const existingMonthlyForm = await prisma.formDefinition.findFirst({
    where: { cohortId: cohort.id, type: ReviewType.MONTHLY, deletedAt: null },
  });
  if (!existingMonthlyForm) {
    await prisma.formDefinition.create({
      data: {
        cohortId: cohort.id,
        type: ReviewType.MONTHLY,
        roleName: RoleName.MENTEE,
        title: 'Monthly meeting form',
        isActive: true,
        schema: {
          fields: [
            {
              id: 'meeting_number',
              labelEn: 'Meeting number',
              labelFr: 'Numéro de la rencontre',
              type: 'short_text',
              required: true,
            },
            {
              id: 'meeting_duration',
              labelEn: 'Duration of the meeting',
              labelFr: 'Durée de la rencontre',
              type: 'short_text',
              required: true,
            },
            {
              id: 'main_topics',
              labelEn:
                'Main topics or themes discussed (e.g. leadership challenges, communication skills)',
              labelFr:
                'Principaux sujets ou thèmes abordés (p. ex. enjeux de leadership, communication)',
              type: 'long_text',
              required: true,
            },
            {
              id: 'issues_raised',
              labelEn: 'Personal or professional issues raised (if any)',
              labelFr: 'Questions personnelles ou professionnelles soulevées (le cas échéant)',
              type: 'long_text',
              required: false,
            },
            {
              id: 'key_insights',
              labelEn: 'Key insights or takeaways from this session',
              labelFr: 'Principaux enseignements tirés de cette séance',
              type: 'long_text',
              required: true,
            },
            {
              id: 'goal_progress',
              labelEn: 'Progress on previously set goals or actions',
              labelFr: 'Progrès sur les objectifs ou actions définis précédemment',
              type: 'single_select',
              required: true,
              options: [
                { value: 'significant', labelEn: 'Significant', labelFr: 'Important' },
                { value: 'moderate', labelEn: 'Moderate', labelFr: 'Modéré' },
                { value: 'limited', labelEn: 'Limited', labelFr: 'Limité' },
                { value: 'none', labelEn: 'No progress', labelFr: 'Aucun progrès' },
              ],
            },
            {
              id: 'progress_comment',
              labelEn: 'Comment on that progress',
              labelFr: 'Commentaire sur ces progrès',
              type: 'long_text',
              required: false,
            },
            {
              id: 'action_1',
              labelEn: 'New goal or action agreed — 1',
              labelFr: 'Nouvel objectif ou action convenu — 1',
              type: 'short_text',
              required: true,
            },
            {
              id: 'action_2',
              labelEn: 'New goal or action agreed — 2',
              labelFr: 'Nouvel objectif ou action convenu — 2',
              type: 'short_text',
              required: false,
            },
            {
              id: 'action_3',
              labelEn: 'New goal or action agreed — 3',
              labelFr: 'Nouvel objectif ou action convenu — 3',
              type: 'short_text',
              required: false,
            },
            {
              id: 'resources_required',
              labelEn: 'Resources or support required (if any)',
              labelFr: 'Ressources ou soutien nécessaires (le cas échéant)',
              type: 'long_text',
              required: false,
            },
            {
              id: 'additional_comments',
              labelEn:
                'Additional comments — notes, observations, or requests for programme support',
              labelFr:
                'Commentaires supplémentaires — notes, observations ou demandes de soutien au programme',
              type: 'long_text',
              required: false,
            },
            {
              id: 'terms_agreed',
              labelEn: 'I agree with the Terms of Use and Privacy Policy',
              labelFr: "J'accepte les conditions d'utilisation et la politique de confidentialité",
              type: 'boolean',
              required: true,
            },
          ],
        },
      },
    });
  }

  // One monthly window per calendar month of the cohort. gatesAccess is false:
  // a missed monthly form produces reminders, never a lockout.
  const existingMonthlyWindows = await prisma.assessmentWindow.findMany({
    where: { cohortId: cohort.id, formType: ReviewType.MONTHLY, deletedAt: null },
    select: { sequence: true },
  });
  if (cohort.startDate) {
    const takenMonths = new Set(existingMonthlyWindows.map((w) => w.sequence));
    const monthlyPlans = planMonthlyWindows({
      startDate: cohort.startDate,
      endDate: cohort.endDate,
    }).filter((plan) => !takenMonths.has(plan.sequence));

    if (monthlyPlans.length > 0) {
      await prisma.assessmentWindow.createMany({
        data: monthlyPlans.map((plan) => ({
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
  }

  // Fill in the months that have already closed for most mentees, and leave the
  // month in progress largely outstanding — so the admin's completion view and
  // the reminder/newsletter path are both demoable on realistic data.
  const monthlyForm = await prisma.formDefinition.findFirst({
    where: {
      cohortId: cohort.id,
      type: ReviewType.MONTHLY,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  const closedMonths = await prisma.assessmentWindow.findMany({
    where: {
      cohortId: cohort.id,
      formType: ReviewType.MONTHLY,
      isActive: true,
      deletedAt: null,
      dueAt: { lte: new Date() },
    },
    orderBy: { sequence: 'asc' },
    select: { id: true },
  });
  if (monthlyForm && closedMonths.length > 0) {
    const monthlyGrants = await prisma.userRole.findMany({
      where: { cohortId: cohort.id, deletedAt: null, roleId: roles.MENTEE },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const monthlyMenteeIds = Array.from(new Set(monthlyGrants.map((g) => g.userId)));

    for (const [index, month] of closedMonths.entries()) {
      const already = await prisma.formResponse.findMany({
        where: { assessmentWindowId: month.id, deletedAt: null },
        select: { respondentId: true },
      });
      const done = new Set(already.map((r) => r.respondentId));
      // Compliance tails off over the months, which is what real programmes see
      // and what makes the reminder feature worth demonstrating.
      const share = Math.max(0.5, 1 - index * 0.08);
      const todo = monthlyMenteeIds
        .slice(0, Math.floor(monthlyMenteeIds.length * share))
        .filter((id) => !done.has(id));
      if (todo.length === 0) continue;

      await prisma.formResponse.createMany({
        data: todo.map((userId, i) => ({
          formId: monthlyForm.id,
          respondentId: userId,
          assessmentWindowId: month.id,
          status: ReviewStatus.SUBMITTED,
          submittedAt: new Date(),
          answers: {
            meeting_number: String(index + 1),
            meeting_duration: i % 2 === 0 ? '60 minutes' : '45 minutes',
            main_topics:
              i % 3 === 0
                ? 'Stakeholder management and handling pushback from senior colleagues.'
                : 'Communication under pressure and delegating to a new team.',
            issues_raised: i % 4 === 0 ? 'Balancing shift work with study time.' : null,
            key_insights:
              'Preparing a one-page brief before a difficult conversation changes how it goes.',
            goal_progress: ['significant', 'moderate', 'moderate', 'limited'][i % 4],
            progress_comment: i % 5 === 0 ? 'Slower than planned, but moving.' : null,
            action_1: 'Lead the next production review meeting.',
            action_2: i % 2 === 0 ? 'Draft a stakeholder map for my unit.' : null,
            action_3: null,
            resources_required: i % 6 === 0 ? 'Access to the leadership reading list.' : null,
            additional_comments: null,
            terms_agreed: true,
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
