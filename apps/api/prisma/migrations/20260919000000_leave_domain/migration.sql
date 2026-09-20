CREATE TYPE "StaffEmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "StaffType" AS ENUM ('TEACHER', 'STAFF');
ALTER TABLE "StaffProfile" ADD COLUMN "employmentStatus" "StaffEmploymentStatus" NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "staffType" "StaffType" NOT NULL DEFAULT 'TEACHER', ADD COLUMN "schoolMembershipId" UUID, ADD COLUMN "boundAt" TIMESTAMP(3), ADD COLUMN "boundByMembershipId" UUID;
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_login_binding_fkey" FOREIGN KEY ("schoolId", "schoolMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT, ADD CONSTRAINT "StaffProfile_binding_auditor_fkey" FOREIGN KEY ("schoolId", "boundByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_binding_audit_check" CHECK (("schoolMembershipId" IS NULL AND "boundAt" IS NULL AND "boundByMembershipId" IS NULL) OR ("schoolMembershipId" IS NOT NULL AND "boundAt" IS NOT NULL AND "boundByMembershipId" IS NOT NULL));
CREATE UNIQUE INDEX "StaffProfile_schoolId_schoolMembershipId_key" ON "StaffProfile"("schoolId", "schoolMembershipId");
CREATE INDEX "StaffProfile_school_status_type_idx" ON "StaffProfile"("schoolId", "employmentStatus", "staffType");
CREATE INDEX "StaffClassAssignment_school_class_effectiveFrom_idx" ON "StaffClassAssignment"("schoolId", "classId", "effectiveFrom");

CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'APPROVED', 'REJECTED');
CREATE TABLE "LeavePolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "effectiveFrom" DATE NOT NULL,
  "nextDayDeadlineLocalTime" TEXT NOT NULL, "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id"), CONSTRAINT "LeavePolicy_deadline_check" CHECK ("nextDayDeadlineLocalTime" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "nextDayDeadlineLocalTime" < '24:00'),
  CONSTRAINT "LeavePolicy_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"), CONSTRAINT "LeavePolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "LeavePolicy_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "LeavePolicy_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "LeavePolicy_schoolId_effectiveFrom_idx" ON "LeavePolicy"("schoolId", "effectiveFrom");
CREATE TRIGGER leave_policy_append_only BEFORE UPDATE OR DELETE ON "LeavePolicy" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TABLE "LeaveRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "studentId" UUID NOT NULL, "parentProfileId" UUID NOT NULL,
  "status" "LeaveRequestStatus" NOT NULL, "policyEffectiveFrom" DATE NOT NULL, "policyDeadlineLocalTime" TEXT NOT NULL,
  "rejectedReason" TEXT, "decidedAt" TIMESTAMP(3), "decidedByMembershipId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id"), CONSTRAINT "LeaveRequest_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "LeaveRequest_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveRequest_parent_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveRequest_student_parent_fkey" FOREIGN KEY ("schoolId", "studentId", "parentProfileId") REFERENCES "StudentParent"("schoolId", "studentId", "parentProfileId") ON DELETE RESTRICT,
  CONSTRAINT "LeaveRequest_decision_membership_fkey" FOREIGN KEY ("schoolId", "decidedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveRequest_state_check" CHECK (("status" IN ('PENDING', 'AUTO_APPROVED') AND "decidedAt" IS NULL AND "decidedByMembershipId" IS NULL AND "rejectedReason" IS NULL) OR ("status" = 'APPROVED' AND "decidedAt" IS NOT NULL AND "decidedByMembershipId" IS NOT NULL AND "rejectedReason" IS NULL) OR ("status" = 'REJECTED' AND "decidedAt" IS NOT NULL AND "decidedByMembershipId" IS NOT NULL AND length(btrim("rejectedReason")) > 0)),
  CONSTRAINT "LeaveRequest_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE INDEX "LeaveRequest_school_student_created_idx" ON "LeaveRequest"("schoolId", "studentId", "createdAt");
CREATE INDEX "LeaveRequest_school_parent_created_idx" ON "LeaveRequest"("schoolId", "parentProfileId", "createdAt");
CREATE INDEX "LeaveRequest_school_decider_created_idx" ON "LeaveRequest"("schoolId", "decidedByMembershipId", "createdAt");
CREATE TABLE "LeaveRequestDay" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "leaveRequestId" UUID NOT NULL, "operatingOn" DATE NOT NULL, "calendarEffectiveFrom" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveRequestDay_pkey" PRIMARY KEY ("id"), CONSTRAINT "LeaveRequestDay_scope_day_key" UNIQUE ("schoolId", "leaveRequestId", "operatingOn"),
  CONSTRAINT "LeaveRequestDay_request_fkey" FOREIGN KEY ("schoolId", "leaveRequestId") REFERENCES "LeaveRequest"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveRequestDay_calendar_version_fkey" FOREIGN KEY ("schoolId", "calendarEffectiveFrom") REFERENCES "SchoolCalendarVersion"("schoolId", "effectiveFrom") ON DELETE RESTRICT
);
CREATE INDEX "LeaveRequestDay_school_operatingOn_idx" ON "LeaveRequestDay"("schoolId", "operatingOn");
CREATE FUNCTION enforce_leave_day_enrollment() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "LeaveRequest" request
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId" = request."schoolId" AND enrollment."studentId" = request."studentId"
    WHERE request."id" = NEW."leaveRequestId"
      AND request."schoolId" = NEW."schoolId"
      AND enrollment."lifecycle" = 'ENROLLED'
      AND enrollment."effectiveFrom" <= NEW."operatingOn"
      AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > NEW."operatingOn")
  ) THEN
    RAISE EXCEPTION 'Leave request day must be inside an ENROLLED interval';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER leave_request_day_enrollment_check BEFORE INSERT OR UPDATE ON "LeaveRequestDay" FOR EACH ROW EXECUTE FUNCTION enforce_leave_day_enrollment();
