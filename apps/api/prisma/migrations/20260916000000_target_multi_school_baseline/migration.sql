CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "SchoolRole" AS ENUM ('SCHOOL_ADMIN', 'STAFF', 'TEACHER', 'FINANCE_MANAGER');
CREATE TYPE "OperationActorType" AS ENUM ('SCHOOL_MEMBERSHIP', 'PLATFORM_OPERATOR_GRANT', 'PARENT_PROFILE');
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "School" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

CREATE TABLE "UserIdentity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "emailNormalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserIdentity_emailNormalized_key" ON "UserIdentity"("emailNormalized");

CREATE TABLE "SchoolMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "userIdentityId" UUID NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "SchoolMembership_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "SchoolMembership_schoolId_userIdentityId_key" ON "SchoolMembership"("schoolId", "userIdentityId");
CREATE INDEX "SchoolMembership_schoolId_status_idx" ON "SchoolMembership"("schoolId", "status");

CREATE TABLE "SchoolRoleGrant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "userIdentityId" UUID NOT NULL,
  "role" "SchoolRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolRoleGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolRoleGrant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "SchoolRoleGrant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SchoolMembership"("id") ON DELETE RESTRICT,
  CONSTRAINT "SchoolRoleGrant_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "SchoolRoleGrant_schoolId_membershipId_role_key" ON "SchoolRoleGrant"("schoolId", "membershipId", "role");
CREATE INDEX "SchoolRoleGrant_schoolId_userIdentityId_idx" ON "SchoolRoleGrant"("schoolId", "userIdentityId");

CREATE TABLE "AuditRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "actorIdentityId" UUID,
  "membershipId" UUID,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "AuditRecord_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT,
  CONSTRAINT "AuditRecord_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SchoolMembership"("id") ON DELETE RESTRICT
);
CREATE INDEX "AuditRecord_schoolId_createdAt_idx" ON "AuditRecord"("schoolId", "createdAt");

CREATE TABLE "Operation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID,
  "membershipId" UUID,
  "actorIdentityId" UUID,
  "actorType" "OperationActorType" NOT NULL,
  "actorReference" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
  "outcome" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Operation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Operation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "Operation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SchoolMembership"("id") ON DELETE RESTRICT,
  CONSTRAINT "Operation_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Operation_schoolId_actorReference_route_fingerprint_key" ON "Operation"("schoolId", "actorReference", "route", "fingerprint");
CREATE INDEX "Operation_schoolId_route_idx" ON "Operation"("schoolId", "route");
