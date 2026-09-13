-- Migration: Add Business Settings and email to Business

-- Add email to businesses table if not exists
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateTable business_settings
CREATE TABLE IF NOT EXISTS "business_settings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "defaultQueueName" TEXT NOT NULL DEFAULT 'General Queue',
  "defaultServiceTime" INTEGER NOT NULL DEFAULT 10,
  "maxQueueCapacity" INTEGER,
  "allowCustomerLeave" BOOLEAN NOT NULL DEFAULT true,
  "allowCustomerRejoin" BOOLEAN NOT NULL DEFAULT false,
  "autoExpireStaleTickets" BOOLEAN NOT NULL DEFAULT false,
  "noShowHandling" TEXT NOT NULL DEFAULT 'MANUAL',

  "welcomeMessage" TEXT,
  "queueInstructions" TEXT,
  "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
  "enableQrJoin" BOOLEAN NOT NULL DEFAULT true,

  "displayTitle" TEXT NOT NULL DEFAULT 'Now Serving',
  "showQrCode" BOOLEAN NOT NULL DEFAULT true,
  "showCurrentlyServing" BOOLEAN NOT NULL DEFAULT true,
  "showWaitingCount" BOOLEAN NOT NULL DEFAULT true,
  "brandingText" TEXT,
  "soundAlertEnabled" BOOLEAN NOT NULL DEFAULT true,

  "operatingHours" JSONB,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_settings_businessId_key" ON "business_settings"("businessId");
CREATE INDEX IF NOT EXISTS "business_settings_businessId_idx" ON "business_settings"("businessId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
