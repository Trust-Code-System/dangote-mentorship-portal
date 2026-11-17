ALTER TABLE "session_logs"
  ADD COLUMN "mentor_reflection" TEXT,
  ADD COLUMN "recorded_by_id" TEXT;

ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_recorded_by_id_fkey"
  FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
