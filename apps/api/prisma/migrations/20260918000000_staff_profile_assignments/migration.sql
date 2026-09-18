CREATE TABLE "StaffProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "dateOfBirth" DATE NOT NULL,
  "gender" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "StaffProfile_schoolId_id_key" ON "StaffProfile"("schoolId", "id");
CREATE INDEX "StaffProfile_schoolId_fullName_idx" ON "StaffProfile"("schoolId", "fullName");

CREATE TABLE "StaffClassAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "staffProfileId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" TEXT NOT NULL,
  "schoolYearName" TEXT NOT NULL,
  "schoolYearStartsOn" DATE NOT NULL,
  "schoolYearEndsOn" DATE NOT NULL,
  "className" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffClassAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffClassAssignment_interval_check" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo"),
  CONSTRAINT "StaffClassAssignment_school_year_interval_check" CHECK (
    "effectiveFrom" >= "schoolYearStartsOn" AND "effectiveFrom" < "schoolYearEndsOn"
    AND ("effectiveTo" IS NULL OR ("effectiveTo" > "schoolYearStartsOn" AND "effectiveTo" <= "schoolYearEndsOn"))
  ),
  CONSTRAINT "StaffClassAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StaffClassAssignment_staff_fkey" FOREIGN KEY ("schoolId", "staffProfileId") REFERENCES "StaffProfile"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StaffClassAssignment_schoolYear_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StaffClassAssignment_class_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "classId") REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "StaffClassAssignment_schoolId_id_key" ON "StaffClassAssignment"("schoolId", "id");
CREATE INDEX "StaffClassAssignment_school_year_effectiveFrom_idx" ON "StaffClassAssignment"("schoolId", "schoolYearId", "effectiveFrom");
CREATE INDEX "StaffClassAssignment_school_staff_effectiveFrom_idx" ON "StaffClassAssignment"("schoolId", "staffProfileId", "effectiveFrom");
ALTER TABLE "StaffClassAssignment" ADD CONSTRAINT "StaffClassAssignment_staff_class_interval_excl"
  EXCLUDE USING gist ("schoolId" WITH =, "staffProfileId" WITH =, "classId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);
