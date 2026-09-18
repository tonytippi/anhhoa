CREATE TABLE "EnrollmentClassAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnrollmentClassAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnrollmentClassAssignment_interval_check" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo"),
  CONSTRAINT "EnrollmentClassAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "EnrollmentClassAssignment_enrollment_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "StudentEnrollment"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "EnrollmentClassAssignment_schoolYear_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "EnrollmentClassAssignment_class_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "classId") REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "EnrollmentClassAssignment_schoolId_id_key" ON "EnrollmentClassAssignment"("schoolId", "id");
CREATE INDEX "EnrollmentClassAssignment_school_enrollment_effectiveFrom_idx" ON "EnrollmentClassAssignment"("schoolId", "enrollmentId", "effectiveFrom");
CREATE INDEX "EnrollmentClassAssignment_school_class_effectiveFrom_idx" ON "EnrollmentClassAssignment"("schoolId", "classId", "effectiveFrom");
ALTER TABLE "EnrollmentClassAssignment" ADD CONSTRAINT "EnrollmentClassAssignment_enrollment_interval_excl"
  EXCLUDE USING gist ("schoolId" WITH =, "enrollmentId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

INSERT INTO "EnrollmentClassAssignment" ("schoolId", "enrollmentId", "schoolYearId", "classId", "effectiveFrom", "effectiveTo", "reason", "updatedAt")
SELECT "schoolId", "id", "schoolYearId", "classId", "effectiveFrom", "endedOn", 'Khởi tạo enrollment', CURRENT_TIMESTAMP
FROM "StudentEnrollment";

ALTER TABLE "SchoolYear"
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedByMembershipId" UUID,
  ADD COLUMN "closeOperationId" UUID;
CREATE UNIQUE INDEX "SchoolYear_closeOperationId_key" ON "SchoolYear"("closeOperationId");
