-- The mentee's monthly meeting form: a second recurring form on the same
-- window machinery as the quarterly assessment, but one that never gates
-- portal access.

-- ── Enum ─────────────────────────────────────────────────────────────────────
-- Safe inside the migration transaction: the new value is not USED below.
ALTER TYPE "ReviewType" ADD VALUE IF NOT EXISTS 'MONTHLY';

-- ── Assessment windows serve both cadences ───────────────────────────────────
-- Existing rows are all quarterly gating windows, which is exactly what these
-- defaults say, so the backfill is a no-op semantically.
ALTER TABLE "assessment_windows"
  ADD COLUMN IF NOT EXISTS "form_type" "ReviewType" NOT NULL DEFAULT 'QUARTERLY',
  ADD COLUMN IF NOT EXISTS "gates_access" BOOLEAN NOT NULL DEFAULT true;

-- Sequence numbering restarts per form type, so uniqueness must include it.
-- Dropped before the new one is created: the old index would reject a monthly
-- window that reuses a sequence number already taken by a quarterly one.
DROP INDEX IF EXISTS "assessment_windows_cohort_id_sequence_key";

CREATE UNIQUE INDEX IF NOT EXISTS "assessment_windows_cohort_id_form_type_sequence_key"
  ON "assessment_windows"("cohort_id", "form_type", "sequence");

DROP INDEX IF EXISTS "assessment_windows_cohort_id_due_at_idx";

CREATE INDEX IF NOT EXISTS "assessment_windows_cohort_id_form_type_due_at_idx"
  ON "assessment_windows"("cohort_id", "form_type", "due_at");
