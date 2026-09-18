CREATE TYPE "DailyJournalImageMimeType" AS ENUM ('JPEG', 'PNG', 'WEBP');

ALTER TABLE "AttendancePolicy" DROP CONSTRAINT "AttendancePolicy_reason_check";
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_reason_check" CHECK (length(trim("reason")) BETWEEN 1 AND 500);

ALTER TABLE "HandoverPolicy" DROP CONSTRAINT "HandoverPolicy_reason_check";
ALTER TABLE "HandoverPolicy" ADD CONSTRAINT "HandoverPolicy_reason_check" CHECK (length(trim("reason")) BETWEEN 1 AND 500);

ALTER TABLE "DailyJournalPolicy"
  ADD COLUMN "parentRetentionDaysAfterEnrollmentEnded" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "acceptedImageMimeTypes" "DailyJournalImageMimeType"[] NOT NULL DEFAULT ARRAY['JPEG', 'PNG', 'WEBP']::"DailyJournalImageMimeType"[],
  ADD COLUMN "maxImageSizeBytes" INTEGER NOT NULL DEFAULT 10485760,
  ADD COLUMN "imageCountLimit" INTEGER,
  DROP CONSTRAINT "DailyJournalPolicy_reason_check",
  ADD CONSTRAINT "DailyJournalPolicy_reason_check" CHECK (length(trim("reason")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "DailyJournalPolicy_fixed_facts_check" CHECK (
    "parentRetentionDaysAfterEnrollmentEnded" = 30
    AND "acceptedImageMimeTypes" = ARRAY['JPEG', 'PNG', 'WEBP']::"DailyJournalImageMimeType"[]
    AND "maxImageSizeBytes" = 10485760
    AND "imageCountLimit" IS NULL
  );
