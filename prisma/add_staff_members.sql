-- Additive migration for BusinessMember and StaffQueueAssignment

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BusinessRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable business_members
CREATE TABLE IF NOT EXISTS "business_members" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "role" "BusinessRole" NOT NULL DEFAULT 'STAFF',
  "status" "MemberStatus" NOT NULL DEFAULT 'INVITED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable staff_queue_assignments
CREATE TABLE IF NOT EXISTS "staff_queue_assignments" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "queueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staff_queue_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_members_businessId_email_key" ON "business_members"("businessId", "email");
CREATE INDEX IF NOT EXISTS "business_members_businessId_idx" ON "business_members"("businessId");
CREATE INDEX IF NOT EXISTS "business_members_userId_idx" ON "business_members"("userId");
CREATE INDEX IF NOT EXISTS "business_members_email_idx" ON "business_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_queue_assignments_memberId_queueId_key" ON "staff_queue_assignments"("memberId", "queueId");
CREATE INDEX IF NOT EXISTS "staff_queue_assignments_memberId_idx" ON "staff_queue_assignments"("memberId");
CREATE INDEX IF NOT EXISTS "staff_queue_assignments_queueId_idx" ON "staff_queue_assignments"("queueId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "business_members" ADD CONSTRAINT "business_members_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "business_members" ADD CONSTRAINT "business_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_queue_assignments" ADD CONSTRAINT "staff_queue_assignments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "business_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_queue_assignments" ADD CONSTRAINT "staff_queue_assignments_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
