CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Class" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "monthlyTuition" BIGINT NOT NULL,
  "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Class_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Class_monthlyTuition_safe_integer" CHECK ("monthlyTuition" >= 0 AND "monthlyTuition" <= 9007199254740991)
);

CREATE TABLE "Student" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fullName" TEXT NOT NULL,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "classId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Class_status_idx" ON "Class"("status");
CREATE INDEX "Student_classId_status_idx" ON "Student"("classId", "status");
