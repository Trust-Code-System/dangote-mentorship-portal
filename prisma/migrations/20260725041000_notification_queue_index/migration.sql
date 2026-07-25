CREATE INDEX "notifications_email_pending_emailed_at_created_at_idx"
ON "notifications"("email_pending", "emailed_at", "created_at");
