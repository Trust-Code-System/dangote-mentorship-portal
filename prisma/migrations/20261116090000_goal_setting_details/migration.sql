ALTER TABLE "goals" ADD COLUMN "setting_details" JSONB;
ALTER TABLE "form_responses" ADD COLUMN "subject_mentee_id" TEXT;
CREATE INDEX "form_responses_form_id_respondent_id_subject_mentee_id_idx" ON "form_responses"("form_id", "respondent_id", "subject_mentee_id");
