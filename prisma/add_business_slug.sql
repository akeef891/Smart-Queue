-- Additive only: add workspace-scoped business slugs without dropping tables or rows.
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "businesses"
SET "slug" = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
  || '-' || right(id, 8)
WHERE "slug" IS NULL OR btrim("slug") = '';

UPDATE "businesses"
SET "slug" = 'business-' || right(id, 8)
WHERE "slug" IS NULL OR btrim("slug") = '';

ALTER TABLE "businesses" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "businesses_workspaceId_slug_key" ON "businesses" ("workspaceId", "slug");
CREATE INDEX IF NOT EXISTS "businesses_workspaceId_name_idx" ON "businesses" ("workspaceId", "name");
