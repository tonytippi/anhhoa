CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT');

CREATE TABLE "Invoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "billingMonth" TEXT NOT NULL,
  "rosterAsOf" DATE NOT NULL,
  "studentCodeSnapshot" TEXT NOT NULL,
  "studentNameSnapshot" TEXT NOT NULL,
  "enrollmentIdSnapshot" UUID NOT NULL,
  "enrollmentLifecycleSnapshot" "StudentEnrollmentLifecycle" NOT NULL,
  "enrollmentEffectiveFromSnapshot" DATE NOT NULL,
  "enrollmentEndedOnSnapshot" DATE,
  "classIdSnapshot" UUID NOT NULL,
  "classNameSnapshot" TEXT NOT NULL,
  "selectionProvenance" JSONB NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "Invoice_student_run_unique" UNIQUE ("schoolId", "studentId", "collectionRunId"),
  CONSTRAINT "Invoice_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "Invoice_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "Invoice_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "Invoice_year_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "Invoice_billing_month_format" CHECK ("billingMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE INDEX "Invoice_schoolId_collectionRunId_idx" ON "Invoice"("schoolId", "collectionRunId");

ALTER TABLE "CollectionRunLifecycleTransition" DROP CONSTRAINT "CollectionRunLifecycleTransition_valid";
ALTER TABLE "CollectionRunLifecycleTransition" ADD CONSTRAINT "CollectionRunLifecycleTransition_valid" CHECK (
  ("previousStatus" IS NULL AND "status" = 'DRAFT')
  OR ("previousStatus" = 'DRAFT' AND "status" = 'READY')
  OR ("previousStatus" = 'READY' AND "status" = 'GENERATED')
  OR ("previousStatus" = 'GENERATED' AND "status" = 'CLOSED')
);
