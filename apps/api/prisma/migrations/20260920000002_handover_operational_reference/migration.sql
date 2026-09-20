ALTER TYPE "NotificationSourceType" ADD VALUE 'HANDOVER';
ALTER TABLE "NotificationSourceEvent" ALTER COLUMN "state" DROP NOT NULL;
ALTER TABLE "NotificationSourceEvent" ADD COLUMN "pickedUpAt" TIMESTAMP(3);
ALTER TABLE "NotificationSourceEvent" ADD CONSTRAINT "NotificationSourceEvent_source_shape_check"
  CHECK (
    ("sourceType"::text = 'ATTENDANCE' AND "state" IS NOT NULL AND "pickedUpAt" IS NULL)
    OR
    ("sourceType"::text = 'HANDOVER' AND "state" IS NULL AND "pickedUpAt" IS NOT NULL)
  );

ALTER TABLE "EvidenceReference" ADD COLUMN "uploadedHandoverOn" DATE;

CREATE TABLE "HandoverRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "handoverOn" DATE NOT NULL,
  "pickedUpAt" TIMESTAMP(3) NOT NULL,
  "evidenceId" UUID,
  "policyEffectiveFrom" DATE NOT NULL,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "staffProfileId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverRecord_school_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "HandoverRecord_student_day_key" UNIQUE ("schoolId", "studentId", "handoverOn"),
  CONSTRAINT "HandoverRecord_evidence_key" UNIQUE ("evidenceId"),
  CONSTRAINT "HandoverRecord_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "HandoverRecord_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "HandoverRecord_evidence_fkey" FOREIGN KEY ("schoolId", "evidenceId") REFERENCES "EvidenceReference"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "HandoverRecord_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "HandoverPolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT,
  CONSTRAINT "HandoverRecord_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "HandoverRecord_staff_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "HandoverRecord_school_day_idx" ON "HandoverRecord"("schoolId", "handoverOn");
CREATE INDEX "EvidenceReference_handover_lookup_idx" ON "EvidenceReference"("schoolId", "uploadedHandoverOn", "uploadedMembershipId", "uploadedStaffProfileId");

CREATE FUNCTION enforce_handover_enrollment() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "StudentEnrollment" enrollment
    WHERE enrollment."schoolId" = NEW."schoolId" AND enrollment."studentId" = NEW."studentId"
      AND enrollment."lifecycle" = 'ENROLLED' AND enrollment."effectiveFrom" <= NEW."handoverOn"
      AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > NEW."handoverOn")
  ) THEN RAISE EXCEPTION 'Handover must be inside an ENROLLED interval'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER handover_record_enrollment_check BEFORE INSERT OR UPDATE ON "HandoverRecord" FOR EACH ROW EXECUTE FUNCTION enforce_handover_enrollment();
