-- Sprint change 2026-10-19: Class note and message inbox events, Web Push outbox and subscriptions.
-- CreateEnum
CREATE TYPE "PushAudience" AS ENUM ('PARENT', 'TEACHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationSourceType" ADD VALUE 'CLASS_NOTE';
ALTER TYPE "NotificationSourceType" ADD VALUE 'MESSAGE';

-- Class note and message events carry neither an attendance state nor a pickup time.
ALTER TABLE "NotificationSourceEvent" DROP CONSTRAINT "NotificationSourceEvent_source_shape_check";
ALTER TABLE "NotificationSourceEvent" ADD CONSTRAINT "NotificationSourceEvent_source_shape_check"
  CHECK (
    ("sourceType"::text = 'ATTENDANCE' AND "state" IS NOT NULL AND "pickedUpAt" IS NULL)
    OR
    ("sourceType"::text = 'HANDOVER' AND "state" IS NULL AND "pickedUpAt" IS NOT NULL)
    OR
    ("sourceType"::text IN ('CLASS_NOTE', 'MESSAGE') AND "state" IS NULL AND "pickedUpAt" IS NULL)
  );

-- AlterTable
ALTER TABLE "NotificationSourceEvent" ADD COLUMN     "pushDispatchedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "StudentMessage" ADD COLUMN     "pushDispatchedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "audience" "PushAudience" NOT NULL,
    "userIdentityId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_audience_userIdentityId_idx" ON "PushSubscription"("audience", "userIdentityId");

-- CreateIndex
CREATE INDEX "NotificationSourceEvent_pushDispatchedAt_createdAt_idx" ON "NotificationSourceEvent"("pushDispatchedAt", "createdAt");

-- CreateIndex
CREATE INDEX "StudentMessage_pushDispatchedAt_createdAt_idx" ON "StudentMessage"("pushDispatchedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Events and messages that existed before push delivery are never pushed retroactively.
UPDATE "NotificationSourceEvent" SET "pushDispatchedAt" = "createdAt" WHERE "pushDispatchedAt" IS NULL;
UPDATE "StudentMessage" SET "pushDispatchedAt" = "createdAt" WHERE "pushDispatchedAt" IS NULL;
