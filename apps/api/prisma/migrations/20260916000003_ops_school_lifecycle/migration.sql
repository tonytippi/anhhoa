CREATE TABLE "PlatformOperatorGrant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userIdentityId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformOperatorGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformOperatorGrant_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "PlatformOperatorGrant_userIdentityId_key" ON "PlatformOperatorGrant"("userIdentityId");
ALTER TABLE "Operation" ADD COLUMN "platformOperatorGrantId" UUID;
ALTER TABLE "Operation" ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "School" ADD COLUMN "initialOwnerIdentityId" UUID;
ALTER TABLE "School" ADD CONSTRAINT "School_initialOwnerIdentityId_fkey" FOREIGN KEY ("initialOwnerIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT;
UPDATE "School" AS school
SET "initialOwnerIdentityId" = (
  SELECT membership."userIdentityId"
  FROM "SchoolMembership" AS membership
  JOIN "SchoolRoleGrant" AS role_grant ON role_grant."membershipId" = membership.id AND role_grant."role" = 'SCHOOL_ADMIN'
  WHERE membership."schoolId" = school.id AND membership.status = 'ACTIVE'
  ORDER BY membership."createdAt", membership.id
  LIMIT 1
)
WHERE school."initialOwnerIdentityId" IS NULL;
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_platformOperatorGrantId_fkey" FOREIGN KEY ("platformOperatorGrantId") REFERENCES "PlatformOperatorGrant"("id") ON DELETE RESTRICT;
DROP INDEX "Operation_schoolId_actorReference_route_fingerprint_key";
UPDATE "Operation"
SET "idempotencyKey" = 'legacy-' || "id"::text
WHERE "idempotencyKey" = '';
CREATE UNIQUE INDEX "Operation_actorReference_route_idempotencyKey_key" ON "Operation"("actorReference", "route", "idempotencyKey");
CREATE INDEX "Operation_platformOperatorGrantId_createdAt_idx" ON "Operation"("platformOperatorGrantId", "createdAt");
