-- Additive only: optional customer phone + cancelledAt on queue_entries.
ALTER TABLE "queue_entries" ALTER COLUMN "customerPhone" DROP NOT NULL;
ALTER TABLE "queue_entries" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
