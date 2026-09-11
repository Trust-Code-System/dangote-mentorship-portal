-- READ-ONLY. Run in the Supabase SQL editor on production.
-- Answers: is every table Prisma expects actually present, and is the migration
-- history clean? A missing table throws P2021 at query time while /api/health
-- (SELECT 1) and sign-in (users only) keep working -- which is exactly the
-- "sign in works, dashboard shows 'Something went wrong'" symptom.

WITH expected(table_name) AS (
  VALUES
    ('accounts'),
    ('action_items'),
    ('agreements'),
    ('assessment_windows'),
    ('audit_logs'),
    ('clinic_questions'),
    ('clinic_rsvps'),
    ('clinic_summaries'),
    ('clinics'),
    ('cohorts'),
    ('competencies'),
    ('conversation_participants'),
    ('conversations'),
    ('feature_flags'),
    ('final_reviews'),
    ('form_definitions'),
    ('form_drafts'),
    ('form_responses'),
    ('forum_categories'),
    ('forum_posts'),
    ('forum_reactions'),
    ('forum_reports'),
    ('forum_threads'),
    ('goal_evidence'),
    ('goal_reviews'),
    ('goals'),
    ('import_rows'),
    ('imports'),
    ('invites'),
    ('matches'),
    ('matching_criteria'),
    ('meetings'),
    ('mentee_profiles'),
    ('mentor_private_notes'),
    ('mentor_profiles'),
    ('message_attachments'),
    ('message_reads'),
    ('messages'),
    ('midterm_reviews'),
    ('newsletter_recipients'),
    ('newsletter_schedules'),
    ('newsletters'),
    ('notification_preferences'),
    ('notifications'),
    ('password_reset_tokens'),
    ('profile_competencies'),
    ('programmes'),
    ('reflection_journal_entries'),
    ('reports'),
    ('resources'),
    ('roles'),
    ('session_logs'),
    ('sessions'),
    ('support_requests'),
    ('training_assessments'),
    ('training_attendance'),
    ('training_batches'),
    ('training_materials'),
    ('translations'),
    ('user_roles'),
    ('users'),
    ('verification_tokens')
),
present AS (
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
),
out AS (
  -- A. Any table Prisma expects that prod does not have. THIS IS THE SMOKING GUN.
  SELECT 1 AS ord, 'A. MISSING TABLE' AS section, e.table_name AS item,
         'expected by schema.prisma, absent on prod' AS detail
  FROM expected e LEFT JOIN present p USING (table_name)
  WHERE p.table_name IS NULL

  -- B. Totals, so "0 missing" is distinguishable from "query broken".
  UNION ALL
  SELECT 2, 'B. totals', 'tables expected / present',
         (SELECT count(*)::text FROM expected) || ' expected, ' ||
         (SELECT count(*)::text FROM expected e JOIN present p USING (table_name)) || ' present'

  -- C. Migration history: unfinished or rolled-back entries.
  UNION ALL
  SELECT 3, 'C. migrations', migration_name,
         format('finished=%s | rolled_back=%s | applied_steps=%s',
                coalesce(finished_at::text, 'NULL  <-- UNFINISHED'),
                coalesce(rolled_back_at::text, 'no'),
                applied_steps_count)
  FROM _prisma_migrations

  -- D. Migration count vs the 16 in the repo.
  UNION ALL
  SELECT 4, 'D. migration count', 'recorded on prod',
         (SELECT count(*)::text FROM _prisma_migrations) || ' of 16 expected'
)
SELECT section, item, detail FROM out ORDER BY ord, item;
