CREATE TYPE "StudentGender" AS ENUM ('NAM', 'NU', 'KHAC');

ALTER TABLE "Student"
  ADD COLUMN "preferredName" TEXT,
  ADD COLUMN "gender" "StudentGender",
  ADD COLUMN "address" TEXT,
  ADD COLUMN "personalIdentifier" TEXT,
  ADD CONSTRAINT "Student_preferredName_length_check" CHECK ("preferredName" IS NULL OR char_length("preferredName") BETWEEN 1 AND 100),
  ADD CONSTRAINT "Student_address_length_check" CHECK ("address" IS NULL OR char_length("address") BETWEEN 1 AND 500),
  ADD CONSTRAINT "Student_personalIdentifier_length_check" CHECK ("personalIdentifier" IS NULL OR char_length("personalIdentifier") BETWEEN 1 AND 100);

CREATE UNIQUE INDEX "Student_personalIdentifier_ci_key"
  ON "Student" (lower("personalIdentifier"))
  WHERE "personalIdentifier" IS NOT NULL;

ALTER TABLE "StudentEnrollment"
  ALTER COLUMN "classId" DROP NOT NULL,
  ALTER COLUMN "className" DROP NOT NULL,
  DROP CONSTRAINT "StudentEnrollment_class_fkey",
  ADD CONSTRAINT "StudentEnrollment_class_fkey"
    FOREIGN KEY ("schoolId", "schoolYearId", "classId")
    REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT;

UPDATE "StudentEnrollment"
SET "classId" = NULL, "className" = NULL
WHERE "lifecycle" = 'WAITING_FOR_CLASS';

ALTER TABLE "StudentEnrollment"
  ADD CONSTRAINT "StudentEnrollment_waiting_class_check"
    CHECK ("lifecycle" <> 'WAITING_FOR_CLASS' OR "classId" IS NULL),
  ADD CONSTRAINT "StudentEnrollment_class_snapshot_check"
    CHECK (("classId" IS NULL AND "className" IS NULL) OR ("classId" IS NOT NULL AND char_length("className") BETWEEN 1 AND 100));

CREATE TABLE "StudentPhoto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "blob" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentPhoto_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StudentPhoto_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "StudentPhoto_schoolId_id_key" ON "StudentPhoto"("schoolId", "id");
CREATE UNIQUE INDEX "StudentPhoto_schoolId_studentId_key" ON "StudentPhoto"("schoolId", "studentId");
