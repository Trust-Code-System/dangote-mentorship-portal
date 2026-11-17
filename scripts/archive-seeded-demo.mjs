import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Owner-authorized launch cleanup. Default is read-only; no hard deletes,
// password changes, messages, storage operations or programme/template changes.
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const target = 'whgzjjjiruhluqxjjacy/mentorship';
const keepIds = ['cmwc5to4x000bfizgoqnn3gtb', 'cmwc5tn6m0004fizg6xvh6sgo'];
const seedCohort = 'cmryti79l0008fi38683ry9bg';
const ids = '(SELECT jsonb_array_elements_text($1::jsonb))';
const owned = (field) => `${field} IN ${ids}`;
const pair = `(${owned('mentor_id')} AND ${owned('mentee_id')})`;
// Identifiers and predicates are source-controlled constants. IDs are parameters.
const rules = {
  users: owned('id'),
  user_roles: owned('user_id'),
  mentor_profiles: owned('user_id'),
  mentee_profiles: owned('user_id'),
  matches: pair,
  meetings: pair,
  session_logs: pair,
  mentor_private_notes: pair,
  goals: owned('mentee_id'),
  goal_reviews: `goal_id IN (SELECT id FROM mentorship.goals WHERE ${owned('mentee_id')})`,
  goal_evidence: `goal_id IN (SELECT id FROM mentorship.goals WHERE ${owned('mentee_id')})`,
  agreements: owned('signed_by_id'),
  action_items: `(${owned('assignee_id')} OR ${owned('created_by_id')})`,
  form_responses: `(${owned('respondent_id')} OR ${owned('subject_mentee_id')})`,
  form_drafts: owned('user_id'),
  reflection_journal_entries: owned('author_id'),
  support_requests: owned('requester_id'),
  reports: `(${owned('author_id')} OR ${owned('subject_user_id')})`,
  notifications: owned('user_id'),
  newsletter_recipients: owned('user_id'),
  notification_preferences: owned('user_id'),
  password_reset_tokens: owned('user_id'),
  training_attendance: owned('user_id'),
  training_assessments: owned('user_id'),
  conversation_participants: owned('user_id'),
  message_reads: owned('user_id'),
  messages: owned('sender_id'),
  forum_threads: owned('author_id'),
  forum_posts: owned('author_id'),
  forum_reactions: owned('user_id'),
  clinic_rsvps: owned('user_id'),
  clinic_questions: owned('author_id'),
  invites: `email IN (SELECT email FROM mentorship.users WHERE ${owned('id')})`,
};

async function run(tx) {
  const [{ schema }] = await tx.$queryRawUnsafe('SELECT current_schema() AS schema');
  const url = new URL(process.env.DATABASE_URL);
  if (`${url.username.replace(/^postgres\./, '')}/${schema}` !== target) {
    throw new Error('Unexpected database target; refusing cleanup.');
  }
  const kept = await tx.$queryRawUnsafe(
    'SELECT id,name,is_active,deleted_at,updated_at FROM mentorship.users WHERE id IN ($1,$2) ORDER BY id',
    ...keepIds,
  );
  if (kept.length !== 2 || kept.some((u) => !u.is_active || u.deleted_at)) {
    throw new Error('Both preserved accounts must exist and be active.');
  }
  const [actor] = await tx.$queryRawUnsafe(
    `SELECT u.id FROM mentorship.users u JOIN mentorship.user_roles ur ON ur.user_id=u.id
     JOIN mentorship.roles r ON r.id=ur.role_id WHERE u.email='admin@dangote.com'
     AND u.is_active AND u.deleted_at IS NULL AND ur.deleted_at IS NULL
     AND ur.cohort_id IS NULL AND r.name='SUPER_ADMIN'`,
  );
  if (!actor) throw new Error('The operational Super Admin must be preserved.');
  const candidates = await tx.$queryRawUnsafe(
    `SELECT id,is_active,deleted_at FROM mentorship.users
     WHERE email ~ '^(mentor|mentee)[.].*[.][0-9]+@dangote[.]com$'
     AND created_at >= '2026-07-24' AND created_at < '2026-07-25' ORDER BY id`,
  );
  if (candidates.length !== 45) throw new Error('Expected exactly 45 original seed accounts.');
  const userIds = JSON.stringify(candidates.map((u) => u.id));
  const unexpected = await tx.$queryRawUnsafe(
    `SELECT ur.id FROM mentorship.user_roles ur JOIN mentorship.roles r ON r.id=ur.role_id
     WHERE ${owned('ur.user_id')} AND ur.deleted_at IS NULL
     AND (r.name NOT IN ('MENTOR','MENTEE') OR ur.cohort_id IS DISTINCT FROM $2)`,
    userIds,
    seedCohort,
  );
  const mixedPairs = await tx.$queryRawUnsafe(
    `SELECT id FROM mentorship.matches WHERE deleted_at IS NULL
     AND ((${owned('mentor_id')}) <> (${owned('mentee_id')}))`,
    userIds,
  );
  if (unexpected.length || mixedPairs.length)
    throw new Error('Demo accounts have unexpected access or real-user pairings.');

  const rows = {};
  for (const [table, predicate] of Object.entries(rules)) {
    rows[table] = await tx.$queryRawUnsafe(
      `SELECT id FROM mentorship.${table} WHERE deleted_at IS NULL AND (${predicate}) ORDER BY id`,
      userIds,
    );
  }
  const counts = Object.fromEntries(
    Object.entries(rows).map(([table, data]) => [table, data.length]),
  );
  const plan = {
    apply,
    target,
    preserve: [...kept.map((user) => user.name), 'operational Super Admin'],
    counts,
  };
  if (!apply) return plan;
  if (process.env.ARCHIVE_CONFIRM_TARGET !== target)
    throw new Error('ARCHIVE_CONFIRM_TARGET must match the reviewed target.');
  const runId = randomUUID();
  const archivedAt = new Date();
  for (const [table, records] of Object.entries(rows)) {
    if (!records.length) continue;
    const changed = await tx.$executeRawUnsafe(
      `UPDATE mentorship.${table} SET deleted_at=$2,updated_at=$2${table === 'users' ? ',is_active=false' : ''}
       WHERE id IN (SELECT jsonb_array_elements_text($1::jsonb)) AND deleted_at IS NULL`,
      JSON.stringify(records.map((r) => r.id)),
      archivedAt,
    );
    if (changed !== records.length)
      throw new Error(`Concurrent changes in ${table}; cleanup rolled back.`);
  }
  const after = await tx.$queryRawUnsafe(
    'SELECT id,name,is_active,deleted_at,updated_at FROM mentorship.users WHERE id IN ($1,$2) ORDER BY id',
    ...keepIds,
  );
  if (JSON.stringify(kept) !== JSON.stringify(after))
    throw new Error('Preserved accounts changed; rolling back.');
  const metadata = {
    runId,
    archivedAt: archivedAt.toISOString(),
    target,
    counts,
    usersBefore: candidates,
    rowIds: Object.fromEntries(
      Object.entries(rows).map(([table, data]) => [table, data.map((r) => r.id)]),
    ),
    recovery:
      'Restore only recorded rowIds whose deleted_at equals archivedAt; restore users is_active from usersBefore. No content or files were deleted.',
  };
  await tx.$executeRawUnsafe(
    `INSERT INTO mentorship.audit_logs (id,actor_id,action,entity_type,entity_id,metadata,created_at,updated_at)
     VALUES ($1,$2,'production.demo_archived','LaunchCleanup',$1,$3::jsonb,$4,$4)`,
    runId,
    actor.id,
    JSON.stringify(metadata),
    archivedAt,
  );
  return { ...plan, runId, archivedAt: archivedAt.toISOString(), preservedAccountsUnchanged: true };
}

try {
  const result = await db.$transaction(run, {
    maxWait: 10_000,
    timeout: 60_000,
    isolationLevel: 'Serializable',
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  // Never print connection strings or provider errors containing credentials.
  console.error(
    error?.code ? `Cleanup failed (${error.code}); transaction rolled back.` : error.message,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
