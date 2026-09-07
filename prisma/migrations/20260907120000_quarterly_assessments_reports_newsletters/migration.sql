-- Quarterly assessments (portal-access gate), exportable reports, and the
-- recurring newsletter schedule.

-- ── Enums ────────────────────────────────────────────────────────────────────
ALTER TYPE "ReviewType" ADD VALUE IF NOT EXISTS 'QUARTERLY';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportKind') THEN
    CREATE TYPE "ReportKind" AS ENUM ('MENTEE_PROGRESS', 'MENTOR_PAIR', 'PROGRAMME');
  END IF;
END
$$;

-- ── Cohort: assessment cadence defaults ──────────────────────────────────────
ALTER TABLE "cohorts"
  ADD COLUMN IF NOT EXISTS "assessment_interval_months" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "assessment_grace_days" INTEGER NOT NULL DEFAULT 7;

-- ── Assessment windows ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assessment_windows" (
  "id"          TEXT NOT NULL,
  "cohort_id"   TEXT NOT NULL,
  "sequence"    INTEGER NOT NULL,
  "label"       TEXT NOT NULL,
  "opens_at"    TIMESTAMP(3) NOT NULL,
  "due_at"      TIMESTAMP(3) NOT NULL,
  "grace_days"  INTEGER NOT NULL DEFAULT 7,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "deleted_at"  TIMESTAMP(3),

  CONSTRAINT "assessment_windows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assessment_windows_cohort_id_sequence_key"
  ON "assessment_windows"("cohort_id", "sequence");
CREATE INDEX IF NOT EXISTS "assessment_windows_cohort_id_due_at_idx"
  ON "assessment_windows"("cohort_id", "due_at");

ALTER TABLE "assessment_windows"
  DROP CONSTRAINT IF EXISTS "assessment_windows_cohort_id_fkey";
ALTER TABLE "assessment_windows"
  ADD CONSTRAINT "assessment_windows_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Form responses: link a response to the assessment window it answers ──────
ALTER TABLE "form_responses"
  ADD COLUMN IF NOT EXISTS "assessment_window_id" TEXT;

CREATE INDEX IF NOT EXISTS "form_responses_assessment_window_id_respondent_id_idx"
  ON "form_responses"("assessment_window_id", "respondent_id");

ALTER TABLE "form_responses"
  DROP CONSTRAINT IF EXISTS "form_responses_assessment_window_id_fkey";
ALTER TABLE "form_responses"
  ADD CONSTRAINT "form_responses_assessment_window_id_fkey"
  FOREIGN KEY ("assessment_window_id") REFERENCES "assessment_windows"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "reports" (
  "id"              TEXT NOT NULL,
  "cohort_id"       TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  "kind"            "ReportKind" NOT NULL,
  "title"           TEXT NOT NULL,
  "subject_user_id" TEXT,
  "period_start"    TIMESTAMP(3),
  "period_end"      TIMESTAMP(3),
  "content"         JSONB NOT NULL,
  "ai_polished"     BOOLEAN NOT NULL DEFAULT false,
  "ai_polished_at"  TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "deleted_at"      TIMESTAMP(3),

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reports_cohort_id_kind_idx" ON "reports"("cohort_id", "kind");
CREATE INDEX IF NOT EXISTS "reports_author_id_idx" ON "reports"("author_id");

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_cohort_id_fkey";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_author_id_fkey";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_subject_user_id_fkey";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_subject_user_id_fkey"
  FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Recurring newsletter schedule ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "newsletter_schedules" (
  "id"               TEXT NOT NULL,
  "cohort_id"        TEXT NOT NULL,
  "enabled"          BOOLEAN NOT NULL DEFAULT false,
  "send_days"        INTEGER[],
  "send_hour"        INTEGER NOT NULL DEFAULT 9,
  "timezone"         TEXT NOT NULL DEFAULT 'Africa/Lagos',
  "auto_draft"       BOOLEAN NOT NULL DEFAULT true,
  "last_drafted_for" TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  "deleted_at"       TIMESTAMP(3),

  CONSTRAINT "newsletter_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_schedules_cohort_id_key"
  ON "newsletter_schedules"("cohort_id");

ALTER TABLE "newsletter_schedules" DROP CONSTRAINT IF EXISTS "newsletter_schedules_cohort_id_fkey";
ALTER TABLE "newsletter_schedules"
  ADD CONSTRAINT "newsletter_schedules_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Newsletters: structured body, bilingual subject, approval, schedule link ─
ALTER TABLE "newsletters"
  ADD COLUMN IF NOT EXISTS "body_json" JSONB,
  ADD COLUMN IF NOT EXISTS "subject_en" TEXT,
  ADD COLUMN IF NOT EXISTS "subject_fr" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ai_drafted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "schedule_id" TEXT;

CREATE INDEX IF NOT EXISTS "newsletters_status_scheduled_at_idx"
  ON "newsletters"("status", "scheduled_at");

ALTER TABLE "newsletters" DROP CONSTRAINT IF EXISTS "newsletters_approved_by_id_fkey";
ALTER TABLE "newsletters"
  ADD CONSTRAINT "newsletters_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "newsletters" DROP CONSTRAINT IF EXISTS "newsletters_schedule_id_fkey";
ALTER TABLE "newsletters"
  ADD CONSTRAINT "newsletters_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "newsletter_schedules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
