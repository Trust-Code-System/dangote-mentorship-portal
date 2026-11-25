ALTER TABLE "matches"
  ADD COLUMN "mentee_certificate_approved_at" TIMESTAMP(3),
  ADD COLUMN "mentee_certificate_approved_by_id" TEXT;

ALTER TABLE "matches" ADD CONSTRAINT "matches_mentee_certificate_approved_by_id_fkey"
  FOREIGN KEY ("mentee_certificate_approved_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
