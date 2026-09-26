CREATE TYPE "CoverageRefundEligibilityReason" AS ENUM ('WITHDRAWAL', 'TRANSFER_OUT', 'ELIGIBLE_SERVICE_CANCELLATION');

CREATE TABLE "CoverageRefundEligibility" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" uuid NOT NULL,
  "studentId" uuid NOT NULL,
  "reason" "CoverageRefundEligibilityReason" NOT NULL,
  "effectiveOn" date NOT NULL,
  "enrollmentId" uuid,
  "actorIdentityId" uuid NOT NULL,
  "membershipId" uuid NOT NULL,
  "operationId" uuid NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoverageRefundEligibility_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CoverageRefundEligibility_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CoverageRefundEligibility_schoolId_enrollmentId_reason_key" UNIQUE ("schoolId", "enrollmentId", "reason"),
  CONSTRAINT "CoverageRefundEligibility_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "CoverageRefundEligibility_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoverageRefundEligibility_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoverageRefundEligibility_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "StudentEnrollment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoverageRefundEligibility_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoverageRefundEligibility_schoolId_operationId_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CoverageRefundEligibility_schoolId_studentId_effectiveOn_idx" ON "CoverageRefundEligibility"("schoolId", "studentId", "effectiveOn");

CREATE OR REPLACE FUNCTION enforce_coverage_refund_eligibility_finality() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'Coverage refund eligibility is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_refund_eligibility_no_mutation BEFORE UPDATE OR DELETE ON "CoverageRefundEligibility" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_refund_eligibility_finality();
