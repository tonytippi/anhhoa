CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE');

CREATE TABLE "SchoolYear" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolYear_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolYear_startsOn_endsOn_check" CHECK ("startsOn" < "endsOn"),
  CONSTRAINT "SchoolYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "SchoolYear_schoolId_id_key" ON "SchoolYear"("schoolId", "id");
CREATE INDEX "SchoolYear_schoolId_startsOn_idx" ON "SchoolYear"("schoolId", "startsOn");
ALTER TABLE "SchoolYear" ADD CONSTRAINT "SchoolYear_school_interval_excl"
  EXCLUDE USING gist ("schoolId" WITH =, daterange("startsOn", "endsOn", '[)') WITH &&);

CREATE TABLE "Class" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Class_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "Class_schoolId_schoolYearId_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT
);

CREATE INDEX "Class_schoolId_schoolYearId_idx" ON "Class"("schoolId", "schoolYearId");
