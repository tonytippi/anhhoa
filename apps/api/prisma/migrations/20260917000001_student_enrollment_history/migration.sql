ALTER TYPE "ClassStatus" ADD VALUE 'ARCHIVED';

CREATE TYPE "StudentEnrollmentLifecycle" AS ENUM (
  'TRIAL', 'WAITING_FOR_CLASS', 'SCHEDULED_TO_START', 'ENROLLED',
  'ON_LEAVE', 'WITHDRAWN', 'GRADUATED'
);

ALTER TABLE "School"
  ADD COLUMN "studentCodePrefix" TEXT NOT NULL,
  ADD COLUMN "studentCodeSequence" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "School_studentCodePrefix_check" CHECK ("studentCodePrefix" ~ '^[A-Z][A-Z0-9]{0,19}$');

CREATE TABLE "Student" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentCode" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "dateOfBirth" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Student_schoolId_id_key" ON "Student"("schoolId", "id");
CREATE UNIQUE INDEX "Student_school_studentCode_ci_key" ON "Student"("schoolId", lower("studentCode"));
CREATE UNIQUE INDEX "Class_schoolId_id_key" ON "Class"("schoolId", "id");
CREATE UNIQUE INDEX "Class_schoolId_schoolYearId_id_key" ON "Class"("schoolId", "schoolYearId", "id");

CREATE TABLE "StudentEnrollment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "lifecycle" "StudentEnrollmentLifecycle" NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "endedOn" DATE,
  "schoolYearName" TEXT NOT NULL,
  "schoolYearStartsOn" DATE NOT NULL,
  "schoolYearEndsOn" DATE NOT NULL,
  "className" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEnrollment_interval_check" CHECK ("endedOn" IS NULL OR "effectiveFrom" < "endedOn"),
   CONSTRAINT "StudentEnrollment_lifecycle_interval_check" CHECK (
     ("lifecycle" IN ('ON_LEAVE', 'WITHDRAWN', 'GRADUATED')) = ("endedOn" IS NOT NULL)
   ),
   CONSTRAINT "StudentEnrollment_school_year_interval_check" CHECK (
     "effectiveFrom" >= "schoolYearStartsOn" AND "effectiveFrom" < "schoolYearEndsOn"
     AND ("endedOn" IS NULL OR ("endedOn" >= "schoolYearStartsOn" AND "endedOn" < "schoolYearEndsOn"))
   ),
  CONSTRAINT "StudentEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StudentEnrollment_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentEnrollment_schoolYear_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentEnrollment_class_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "classId") REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "StudentEnrollment_school_student_year_key" ON "StudentEnrollment"("schoolId", "studentId", "schoolYearId");
CREATE UNIQUE INDEX "StudentEnrollment_schoolId_id_key" ON "StudentEnrollment"("schoolId", "id");
CREATE INDEX "StudentEnrollment_school_class_lifecycle_idx" ON "StudentEnrollment"("schoolId", "classId", "lifecycle");
CREATE INDEX "StudentEnrollment_school_student_createdAt_idx" ON "StudentEnrollment"("schoolId", "studentId", "createdAt");

CREATE TABLE "StudentEnrollmentLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "previousLifecycle" "StudentEnrollmentLifecycle",
  "lifecycle" "StudentEnrollmentLifecycle" NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "endedOn" DATE,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentEnrollmentLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEnrollmentLifecycleTransition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StudentEnrollmentLifecycleTransition_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "StudentEnrollment"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "StudentEnrollmentLifecycleTransition_school_enrollment_createdAt_idx" ON "StudentEnrollmentLifecycleTransition"("schoolId", "enrollmentId", "createdAt");
CREATE INDEX "StudentEnrollmentLifecycleTransition_school_operation_idx" ON "StudentEnrollmentLifecycleTransition"("schoolId", "operationId");
