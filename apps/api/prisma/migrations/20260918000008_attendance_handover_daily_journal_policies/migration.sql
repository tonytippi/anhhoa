CREATE TYPE "PhotoEvidenceMode" AS ENUM ('REQUIRED', 'OPTIONAL');

CREATE TABLE "AttendancePolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "photoEvidenceMode" "PhotoEvidenceMode" NOT NULL,
  "reason" TEXT NOT NULL, "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendancePolicy_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "AttendancePolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "AttendancePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendancePolicy_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendancePolicy_reason_check" CHECK (length(trim("reason")) > 0)
);
CREATE INDEX "AttendancePolicy_schoolId_effectiveFrom_idx" ON "AttendancePolicy"("schoolId", "effectiveFrom");

CREATE TABLE "HandoverPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "photoEvidenceMode" "PhotoEvidenceMode" NOT NULL,
  "reason" TEXT NOT NULL, "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverPolicy_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "HandoverPolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "HandoverPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HandoverPolicy_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HandoverPolicy_reason_check" CHECK (length(trim("reason")) > 0)
);
CREATE INDEX "HandoverPolicy_schoolId_effectiveFrom_idx" ON "HandoverPolicy"("schoolId", "effectiveFrom");

CREATE TABLE "DailyJournalPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "reason" TEXT NOT NULL,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyJournalPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyJournalPolicy_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "DailyJournalPolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "DailyJournalPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DailyJournalPolicy_membership_graph_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DailyJournalPolicy_reason_check" CHECK (length(trim("reason")) > 0)
);
CREATE INDEX "DailyJournalPolicy_schoolId_effectiveFrom_idx" ON "DailyJournalPolicy"("schoolId", "effectiveFrom");

CREATE TRIGGER attendance_policy_append_only BEFORE UPDATE OR DELETE ON "AttendancePolicy" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER handover_policy_append_only BEFORE UPDATE OR DELETE ON "HandoverPolicy" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER daily_journal_policy_append_only BEFORE UPDATE OR DELETE ON "DailyJournalPolicy" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
