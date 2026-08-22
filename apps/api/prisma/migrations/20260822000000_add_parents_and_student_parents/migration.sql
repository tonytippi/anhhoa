CREATE TYPE "ParentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "StudentParentStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "Parent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "emailNormalized" TEXT NOT NULL,
  "googleSubject" TEXT,
  "displayName" TEXT,
  "status" "ParentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentParent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "parentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" "StudentParentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" UUID,
  CONSTRAINT "StudentParent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentParent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentParent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentParent_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Parent_emailNormalized_key" ON "Parent"("emailNormalized");
CREATE UNIQUE INDEX "Parent_googleSubject_key" ON "Parent"("googleSubject");
CREATE UNIQUE INDEX "StudentParent_parentId_studentId_key" ON "StudentParent"("parentId", "studentId");
CREATE INDEX "StudentParent_studentId_status_idx" ON "StudentParent"("studentId", "status");
CREATE INDEX "StudentParent_parentId_status_idx" ON "StudentParent"("parentId", "status");
CREATE INDEX "StudentParent_revokedBy_idx" ON "StudentParent"("revokedBy");
