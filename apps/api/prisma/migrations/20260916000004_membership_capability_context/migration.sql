CREATE TYPE "SchoolRole_new" AS ENUM ('SCHOOL_ADMIN', 'FINANCE_MANAGER', 'CLASS_TEACHER');
ALTER TABLE "SchoolRoleGrant" ALTER COLUMN "role" TYPE "SchoolRole_new" USING (
  CASE WHEN "role"::text IN ('STAFF', 'TEACHER') THEN 'CLASS_TEACHER' ELSE "role"::text END::"SchoolRole_new"
);
DROP TYPE "SchoolRole";
ALTER TYPE "SchoolRole_new" RENAME TO "SchoolRole";

ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_id_key" UNIQUE ("schoolId", "id");
ALTER TABLE "SchoolRoleGrant" DROP CONSTRAINT "SchoolRoleGrant_membershipId_fkey";
ALTER TABLE "SchoolRoleGrant" DROP CONSTRAINT "SchoolRoleGrant_userIdentityId_fkey";
ALTER TABLE "SchoolRoleGrant" DROP COLUMN "userIdentityId";
ALTER TABLE "SchoolRoleGrant" ADD CONSTRAINT "SchoolRoleGrant_schoolId_membershipId_fkey"
  FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;
DROP INDEX IF EXISTS "SchoolRoleGrant_schoolId_userIdentityId_idx";
CREATE INDEX "SchoolRoleGrant_schoolId_membershipId_idx" ON "SchoolRoleGrant"("schoolId", "membershipId");
