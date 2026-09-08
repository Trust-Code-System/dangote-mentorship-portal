ALTER TABLE "conversations" ADD COLUMN "direct_key" TEXT;

WITH direct_conversations AS (
  SELECT
    c."id",
    c."created_at",
    c."cohort_id" || ':' || string_agg(cp."user_id", ':' ORDER BY cp."user_id") AS pair_key,
    count(*) AS participant_count
  FROM "conversations" c
  JOIN "conversation_participants" cp
    ON cp."conversation_id" = c."id" AND cp."deleted_at" IS NULL
  WHERE c."type" = 'DIRECT' AND c."deleted_at" IS NULL
  GROUP BY c."id", c."cohort_id", c."created_at"
), ranked_direct_conversations AS (
  SELECT
    "id",
    pair_key,
    row_number() OVER (
      PARTITION BY pair_key
      ORDER BY "created_at", "id"
    ) AS pair_rank
  FROM direct_conversations
  WHERE participant_count = 2
)
UPDATE "conversations" c
SET "direct_key" = ranked.pair_key
FROM ranked_direct_conversations ranked
WHERE c."id" = ranked."id" AND ranked.pair_rank = 1;

CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");
