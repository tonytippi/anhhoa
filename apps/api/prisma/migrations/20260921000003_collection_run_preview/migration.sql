CREATE TYPE "CollectionRunType" AS ENUM ('MONTHLY');
CREATE TYPE "CollectionRunStatus" AS ENUM ('DRAFT', 'READY', 'GENERATED', 'CLOSED');

CREATE TABLE "CollectionRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "type" "CollectionRunType" NOT NULL DEFAULT 'MONTHLY',
  "billingMonth" TEXT NOT NULL,
  "status" "CollectionRunStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRun_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRun_month_unique" UNIQUE ("schoolId", "schoolYearId", "billingMonth"),
  CONSTRAINT "CollectionRun_month_format" CHECK ("billingMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "CollectionRun_version_positive" CHECK ("version" > 0),
  CONSTRAINT "CollectionRun_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRun_year_graph_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CollectionRun_schoolId_schoolYearId_billingMonth_idx" ON "CollectionRun"("schoolId", "schoolYearId", "billingMonth");

CREATE TABLE "CollectionRunSelection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionRunSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunSelection_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRunSelection_unique" UNIQUE ("schoolId", "collectionRunId", "studentId"),
  CONSTRAINT "CollectionRunSelection_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunSelection_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CollectionRunSelection_schoolId_collectionRunId_idx" ON "CollectionRunSelection"("schoolId", "collectionRunId");
