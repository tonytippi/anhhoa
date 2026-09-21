CREATE TYPE "CollectionRunGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'FAILED', 'COMPLETED');
CREATE TYPE "CollectionRunGenerationItemStatus" AS ENUM ('PENDING', 'STAGED', 'SKIPPED');

CREATE TABLE "CollectionRunGeneration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "status" "CollectionRunGenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "totalCount" INTEGER NOT NULL,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionRunGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunGeneration_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRunGeneration_run_key" UNIQUE ("schoolId", "collectionRunId"),
  CONSTRAINT "CollectionRunGeneration_operation_key" UNIQUE ("schoolId", "operationId"),
  CONSTRAINT "CollectionRunGeneration_counts_valid" CHECK ("totalCount" >= 0 AND "processedCount" >= 0 AND "eligibleCount" >= 0 AND "skippedCount" >= 0 AND "processedCount" <= "totalCount" AND "eligibleCount" + "skippedCount" = "processedCount"),
  CONSTRAINT "CollectionRunGeneration_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunGeneration_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunGeneration_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CollectionRunGeneration_claim_idx" ON "CollectionRunGeneration" ("status", "leaseExpiresAt", "createdAt");

CREATE TABLE "CollectionRunGenerationItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "generationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "status" "CollectionRunGenerationItemStatus" NOT NULL DEFAULT 'PENDING',
  "snapshot" JSONB,
  "skip" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionRunGenerationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunGenerationItem_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRunGenerationItem_student_key" UNIQUE ("schoolId", "generationId", "studentId"),
  CONSTRAINT "CollectionRunGenerationItem_ordinal_key" UNIQUE ("schoolId", "generationId", "ordinal"),
  CONSTRAINT "CollectionRunGenerationItem_payload_valid" CHECK (("status" IN ('PENDING', 'STAGED') AND "snapshot" IS NOT NULL AND "skip" IS NULL) OR ("status" = 'SKIPPED' AND "snapshot" IS NULL AND "skip" IS NOT NULL)),
  CONSTRAINT "CollectionRunGenerationItem_generation_fkey" FOREIGN KEY ("schoolId", "generationId") REFERENCES "CollectionRunGeneration"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CollectionRunGenerationItem_pending_idx" ON "CollectionRunGenerationItem" ("schoolId", "generationId", "status", "ordinal");
