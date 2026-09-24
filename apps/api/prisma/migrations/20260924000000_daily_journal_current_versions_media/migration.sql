CREATE TABLE "DailyJournal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "classId" UUID NOT NULL, "studentId" UUID NOT NULL,
  "journalDate" DATE NOT NULL, "text" TEXT NOT NULL, "currentVersion" INTEGER NOT NULL DEFAULT 1, "policyEffectiveFrom" DATE NOT NULL,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "staffProfileId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyJournal_pkey" PRIMARY KEY ("id"), CONSTRAINT "DailyJournal_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "DailyJournal_current_key" UNIQUE ("schoolId", "studentId", "journalDate"),
  CONSTRAINT "DailyJournal_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournal_class_graph_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournal_student_graph_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournal_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "DailyJournalPolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournal_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournal_staff_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "DailyJournal_schoolId_classId_journalDate_idx" ON "DailyJournal"("schoolId", "classId", "journalDate");
CREATE TABLE "DailyJournalVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "dailyJournalId" UUID NOT NULL, "version" INTEGER NOT NULL, "text" TEXT NOT NULL,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "staffProfileId" UUID NOT NULL, "policyEffectiveFrom" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyJournalVersion_pkey" PRIMARY KEY ("id"), CONSTRAINT "DailyJournalVersion_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "DailyJournalVersion_version_key" UNIQUE ("schoolId", "dailyJournalId", "version"),
  CONSTRAINT "DailyJournalVersion_journal_fkey" FOREIGN KEY ("schoolId", "dailyJournalId") REFERENCES "DailyJournal"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalVersion_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalVersion_staff_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
  ,CONSTRAINT "DailyJournalVersion_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "DailyJournalPolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT
);
CREATE TABLE "DailyJournalMedia" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "classId" UUID NOT NULL, "studentId" UUID NOT NULL, "journalDate" DATE NOT NULL,
  "contentType" TEXT NOT NULL, "blob" BYTEA NOT NULL, "uploadedByMembershipId" UUID NOT NULL, "uploadedByStaffProfileId" UUID NOT NULL, "policyEffectiveFrom" DATE NOT NULL, "attachedDailyJournalId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyJournalMedia_pkey" PRIMARY KEY ("id"), CONSTRAINT "DailyJournalMedia_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "DailyJournalMedia_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalMedia_class_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalMedia_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalMedia_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "DailyJournalPolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalMedia_membership_fkey" FOREIGN KEY ("schoolId", "uploadedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalMedia_staff_fkey" FOREIGN KEY ("schoolId", "uploadedByStaffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "DailyJournalMedia_scope_idx" ON "DailyJournalMedia"("schoolId", "classId", "studentId", "journalDate");
CREATE INDEX "DailyJournalMedia_attachment_idx" ON "DailyJournalMedia"("schoolId", "attachedDailyJournalId");
CREATE TABLE "DailyJournalVersionMedia" (
  "schoolId" UUID NOT NULL, "dailyJournalVersionId" UUID NOT NULL, "mediaId" UUID NOT NULL,
  CONSTRAINT "DailyJournalVersionMedia_pkey" PRIMARY KEY ("schoolId", "dailyJournalVersionId", "mediaId"),
  CONSTRAINT "DailyJournalVersionMedia_version_fkey" FOREIGN KEY ("schoolId", "dailyJournalVersionId") REFERENCES "DailyJournalVersion"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "DailyJournalVersionMedia_media_fkey" FOREIGN KEY ("schoolId", "mediaId") REFERENCES "DailyJournalMedia"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "DailyJournalVersionMedia_media_idx" ON "DailyJournalVersionMedia"("schoolId", "mediaId");
CREATE FUNCTION reject_daily_journal_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = 'DELETE' AND current_setting('passionedu.allow_daily_journal_history_cleanup', true) = 'on' THEN RETURN OLD; END IF; RAISE EXCEPTION 'daily journal version history is append-only'; END; $$;
CREATE TRIGGER daily_journal_version_append_only BEFORE UPDATE OR DELETE ON "DailyJournalVersion" FOR EACH ROW EXECUTE FUNCTION reject_daily_journal_history_mutation();
CREATE TRIGGER daily_journal_version_media_append_only BEFORE UPDATE OR DELETE ON "DailyJournalVersionMedia" FOR EACH ROW EXECUTE FUNCTION reject_daily_journal_history_mutation();
