ALTER TABLE "EvidenceReference"
  ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN "uploadedClassId" UUID,
  ADD COLUMN "uploadedAttendanceOn" DATE,
  ADD COLUMN "uploadedMembershipId" UUID,
  ADD COLUMN "uploadedStaffProfileId" UUID,
  ADD COLUMN "blob" BYTEA,
  ADD COLUMN "preview" BYTEA,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedStudentId" UUID,
  ADD COLUMN "confirmedAttendanceOn" DATE,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletionReason" TEXT;

ALTER TABLE "EvidenceReference"
  ADD CONSTRAINT "EvidenceReference_uploaded_class_fkey" FOREIGN KEY ("schoolId", "uploadedClassId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "EvidenceReference_uploaded_membership_fkey" FOREIGN KEY ("schoolId", "uploadedMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "EvidenceReference_uploaded_staff_fkey" FOREIGN KEY ("schoolId", "uploadedStaffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "EvidenceReference_confirmed_student_fkey"
  FOREIGN KEY ("schoolId", "confirmedStudentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT;
UPDATE "EvidenceReference" SET "uploadedClassId" = (SELECT "classId" FROM "AttendanceRecord" WHERE "evidenceId" = "EvidenceReference"."id" LIMIT 1), "uploadedAttendanceOn" = (SELECT "attendanceOn" FROM "AttendanceRecord" WHERE "evidenceId" = "EvidenceReference"."id" LIMIT 1), "uploadedMembershipId" = (SELECT "membershipId" FROM "AttendanceRecord" WHERE "evidenceId" = "EvidenceReference"."id" LIMIT 1), "uploadedStaffProfileId" = (SELECT "staffProfileId" FROM "AttendanceRecord" WHERE "evidenceId" = "EvidenceReference"."id" LIMIT 1);
CREATE INDEX "EvidenceReference_expiry_idx"
  ON "EvidenceReference"("schoolId", "confirmedAt")
  WHERE "confirmedAt" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "EvidenceReference_upload_target_idx" ON "EvidenceReference"("schoolId", "uploadedClassId", "uploadedAttendanceOn");
CREATE UNIQUE INDEX "AttendanceRecord_school_evidence_key" ON "AttendanceRecord"("schoolId", "evidenceId") WHERE "evidenceId" IS NOT NULL;

CREATE TYPE "NotificationSourceType" AS ENUM ('ATTENDANCE');

CREATE TABLE "NotificationSourceEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "sourceType" "NotificationSourceType" NOT NULL,
  "sourceRecordId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "attendanceOn" DATE NOT NULL,
  "state" "AttendanceState" NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationSourceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationSourceEvent_school_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "NotificationSourceEvent_source_key" UNIQUE ("schoolId", "sourceType", "sourceRecordId"),
  CONSTRAINT "NotificationSourceEvent_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationSourceEvent_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "NotificationSourceEvent_school_student_day_idx" ON "NotificationSourceEvent"("schoolId", "studentId", "attendanceOn");
