CREATE TYPE "AttendanceState" AS ENUM ('PRESENT', 'ABSENT');

CREATE TABLE "EvidenceReference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvidenceReference_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "EvidenceReference_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);

CREATE TABLE "AttendanceRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "attendanceOn" DATE NOT NULL,
  "state" "AttendanceState" NOT NULL,
  "evidenceId" UUID,
  "policyEffectiveFrom" DATE NOT NULL,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "staffProfileId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceRecord_scope_roster_day_key" UNIQUE ("schoolId", "classId", "studentId", "attendanceOn"),
  CONSTRAINT "AttendanceRecord_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_class_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_evidence_fkey" FOREIGN KEY ("schoolId", "evidenceId") REFERENCES "EvidenceReference"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "AttendancePolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_staff_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "AttendanceRecord_absent_evidence_check" CHECK ("state" = 'PRESENT' OR "evidenceId" IS NULL)
);
CREATE INDEX "AttendanceRecord_school_class_day_idx" ON "AttendanceRecord"("schoolId", "classId", "attendanceOn");
CREATE INDEX "AttendanceRecord_school_student_day_idx" ON "AttendanceRecord"("schoolId", "studentId", "attendanceOn");

CREATE FUNCTION enforce_attendance_record_roster() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "StudentEnrollment" enrollment
    JOIN "EnrollmentClassAssignment" placement
      ON placement."schoolId" = enrollment."schoolId" AND placement."enrollmentId" = enrollment."id"
    WHERE enrollment."schoolId" = NEW."schoolId" AND enrollment."studentId" = NEW."studentId"
      AND enrollment."lifecycle" = 'ENROLLED'
      AND enrollment."effectiveFrom" <= NEW."attendanceOn"
      AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > NEW."attendanceOn")
      AND placement."classId" = NEW."classId"
      AND placement."effectiveFrom" <= NEW."attendanceOn"
      AND (placement."effectiveTo" IS NULL OR placement."effectiveTo" > NEW."attendanceOn")
  ) THEN RAISE EXCEPTION 'Attendance record must belong to an ENROLLED Student placement'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER attendance_record_roster_check BEFORE INSERT OR UPDATE ON "AttendanceRecord" FOR EACH ROW EXECUTE FUNCTION enforce_attendance_record_roster();
