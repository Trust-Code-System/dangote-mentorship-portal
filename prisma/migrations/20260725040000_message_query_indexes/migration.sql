CREATE INDEX "conversation_participants_user_id_deleted_at_idx"
ON "conversation_participants"("user_id", "deleted_at");

CREATE INDEX "messages_conversation_id_created_at_idx"
ON "messages"("conversation_id", "created_at");

CREATE INDEX "message_reads_user_id_message_id_idx"
ON "message_reads"("user_id", "message_id");
