CREATE TYPE "StudentParentStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "ParentProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "emailNormalized" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "userIdentityId" UUID,
  "boundAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentProfile_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "ParentProfile_emailNormalized_key" ON "ParentProfile"("emailNormalized");
CREATE UNIQUE INDEX "ParentProfile_userIdentityId_key" ON "ParentProfile"("userIdentityId");

CREATE TABLE "StudentParent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "parentProfileId" UUID NOT NULL,
  "status" "StudentParentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "StudentParent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentParent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "StudentParent_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentParent_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT,
  CONSTRAINT "StudentParent_status_revokedAt_check" CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "StudentParent_schoolId_id_key" ON "StudentParent"("schoolId", "id");
CREATE UNIQUE INDEX "StudentParent_school_student_parent_key" ON "StudentParent"("schoolId", "studentId", "parentProfileId");
CREATE INDEX "StudentParent_parent_status_idx" ON "StudentParent"("parentProfileId", "status");
CREATE INDEX "StudentParent_school_student_status_idx" ON "StudentParent"("schoolId", "studentId", "status");
