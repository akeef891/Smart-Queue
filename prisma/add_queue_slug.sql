-- Additive: queue slug + INACTIVE status. Does not drop tables or existing rows.

ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "queues"
SET "slug" = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
  || '-' || right(id, 8)
WHERE "slug" IS NULL OR btrim("slug") = '';

UPDATE "queues"
SET "slug" = 'queue-' || right(id, 8)
WHERE "slug" IS NULL OR btrim("slug") = '';

ALTER TABLE "queues" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "queues_businessId_slug_key" ON "queues" ("businessId", "slug");
