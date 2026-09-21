ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_schoolId_id_key" UNIQUE ("schoolId", "id");

CREATE OR REPLACE FUNCTION "validate_audit_actor_provenance"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."actorType" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."actorType" = 'SCHOOL_MEMBERSHIP' AND EXISTS (
    SELECT 1 FROM "SchoolMembership" AS membership
    WHERE membership."id"::text = NEW."actorReference"
      AND membership."id" = NEW."membershipId"
      AND membership."schoolId" = NEW."schoolId"
      AND membership."userIdentityId" = NEW."actorIdentityId"
  ) THEN RETURN NEW; END IF;

  IF NEW."actorType" = 'PARENT_PROFILE' AND NEW."membershipId" IS NULL AND EXISTS (
    SELECT 1 FROM "ParentProfile" parent
    JOIN "StudentParent" link ON link."parentProfileId" = parent."id"
    WHERE parent."id"::text = NEW."actorReference"
      AND parent."userIdentityId" = NEW."actorIdentityId"
      AND link."schoolId" = NEW."schoolId"
      AND link."status" = 'ACTIVE'
  ) THEN RETURN NEW; END IF;

  IF NEW."actorType" = 'PLATFORM_OPERATOR_GRANT' AND NEW."membershipId" IS NULL AND EXISTS (
    SELECT 1 FROM "PlatformOperatorGrant" operator_grant
    WHERE operator_grant."id"::text = NEW."actorReference"
      AND operator_grant."userIdentityId" = NEW."actorIdentityId"
  ) THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'AuditRecord actor provenance does not match its typed actor context';
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "LeaveDaySource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "operatingOn" DATE NOT NULL,
  "leaveRequestId" UUID NOT NULL,
  "leaveStatus" "LeaveRequestStatus" NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveDaySource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveDaySource_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "LeaveDaySource_scope_student_day_key" UNIQUE ("schoolId", "studentId", "operatingOn"),
  CONSTRAINT "LeaveDaySource_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveDaySource_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveDaySource_request_fkey" FOREIGN KEY ("schoolId", "leaveRequestId") REFERENCES "LeaveRequest"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "LeaveDaySource_school_operating_student_idx" ON "LeaveDaySource"("schoolId", "operatingOn", "studentId");

CREATE TABLE "LeaveDaySourceExclusion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "leaveDaySourceId" UUID NOT NULL,
  "attendanceRecordId" UUID NOT NULL,
  "excludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveDaySourceExclusion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveDaySourceExclusion_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "LeaveDaySourceExclusion_scope_source_attendance_key" UNIQUE ("schoolId", "leaveDaySourceId", "attendanceRecordId"),
  CONSTRAINT "LeaveDaySourceExclusion_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveDaySourceExclusion_source_fkey" FOREIGN KEY ("schoolId", "leaveDaySourceId") REFERENCES "LeaveDaySource"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "LeaveDaySourceExclusion_attendance_fkey" FOREIGN KEY ("schoolId", "attendanceRecordId") REFERENCES "AttendanceRecord"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "LeaveDaySourceExclusion_school_source_idx" ON "LeaveDaySourceExclusion"("schoolId", "leaveDaySourceId");

CREATE FUNCTION enforce_leave_day_source_issue() RETURNS trigger AS $$
BEGIN
  IF NEW."leaveStatus" NOT IN ('AUTO_APPROVED', 'APPROVED') OR NOT EXISTS (
    SELECT 1 FROM "LeaveRequest" request JOIN "LeaveRequestDay" day
      ON day."schoolId" = request."schoolId" AND day."leaveRequestId" = request."id"
    WHERE request."schoolId" = NEW."schoolId" AND request."id" = NEW."leaveRequestId"
      AND request."studentId" = NEW."studentId" AND request."status" = NEW."leaveStatus"
      AND day."operatingOn" = NEW."operatingOn"
  ) THEN RAISE EXCEPTION 'Leave day source must be issued from an approved leave request day'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER leave_day_source_issue_check BEFORE INSERT ON "LeaveDaySource" FOR EACH ROW EXECUTE FUNCTION enforce_leave_day_source_issue();
CREATE FUNCTION enforce_leave_day_source_exclusion() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "LeaveDaySource" source JOIN "AttendanceRecord" attendance
      ON attendance."schoolId" = source."schoolId"
    WHERE source."schoolId" = NEW."schoolId" AND source."id" = NEW."leaveDaySourceId"
      AND attendance."id" = NEW."attendanceRecordId" AND attendance."state" = 'PRESENT'
      AND attendance."studentId" = source."studentId" AND attendance."attendanceOn" = source."operatingOn"
  ) THEN RAISE EXCEPTION 'Leave day source exclusion requires matching PRESENT attendance'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER leave_day_source_exclusion_check BEFORE INSERT ON "LeaveDaySourceExclusion" FOR EACH ROW EXECUTE FUNCTION enforce_leave_day_source_exclusion();
CREATE TRIGGER leave_day_source_append_only BEFORE UPDATE OR DELETE ON "LeaveDaySource" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER leave_day_source_exclusion_append_only BEFORE UPDATE OR DELETE ON "LeaveDaySourceExclusion" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();

INSERT INTO "LeaveDaySource" ("schoolId", "studentId", "operatingOn", "leaveRequestId", "leaveStatus")
SELECT "schoolId", "studentId", "operatingOn", "id", "status"
FROM (
  SELECT request."schoolId", request."studentId", day."operatingOn", request."id", request."status",
    row_number() OVER (
      PARTITION BY request."schoolId", request."studentId", day."operatingOn"
      ORDER BY request."decidedAt" NULLS FIRST, request."createdAt", request."id"
    ) AS source_rank
  FROM "LeaveRequest" request
  JOIN "LeaveRequestDay" day ON day."schoolId" = request."schoolId" AND day."leaveRequestId" = request."id"
  WHERE request."status" IN ('AUTO_APPROVED', 'APPROVED')
) candidates
WHERE source_rank = 1;

INSERT INTO "LeaveDaySourceExclusion" ("schoolId", "leaveDaySourceId", "attendanceRecordId")
SELECT source."schoolId", source."id", attendance."id"
FROM "LeaveDaySource" source
JOIN "AttendanceRecord" attendance
  ON attendance."schoolId" = source."schoolId"
  AND attendance."studentId" = source."studentId"
  AND attendance."attendanceOn" = source."operatingOn"
WHERE attendance."state" = 'PRESENT';
