CREATE TYPE "SchoolPositionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "SchoolPosition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "status" "SchoolPositionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolPosition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolPosition_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "SchoolPosition_school_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "SchoolPosition_school_code_key" UNIQUE ("schoolId", "code"),
  CONSTRAINT "SchoolPosition_school_name_key" UNIQUE ("schoolId", "name")
);
CREATE TABLE "PositionCapabilityGrant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "positionId" UUID NOT NULL,
  "capability" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PositionCapabilityGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PositionCapabilityGrant_position_fkey" FOREIGN KEY ("schoolId", "positionId") REFERENCES "SchoolPosition"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "PositionCapabilityGrant_unique" UNIQUE ("schoolId", "positionId", "capability")
);
ALTER TABLE "StaffProfile" ADD COLUMN "primaryPositionId" UUID;
INSERT INTO "SchoolPosition" ("schoolId", "code", "name", "updatedAt") SELECT s."id", v.code, v.name, CURRENT_TIMESTAMP FROM "School" s CROSS JOIN (VALUES ('HIEU_TRUONG','Hiệu trưởng'),('QUAN_LY_TRUONG','Quản lý trường'),('KE_TOAN','Kế toán'),('GIAO_VIEN','Giáo viên'),('TUYEN_SINH','Nhân viên tuyển sinh'),('BEP','Bếp'),('Y_TE','Y tế')) AS v(code,name);
-- Legacy staff without a role grant must not inherit shared Position capabilities.
-- Granted bindings are reassigned deterministically below before legacy grants are removed.
UPDATE "StaffProfile" staff SET "primaryPositionId" = position."id" FROM "SchoolPosition" position WHERE position."schoolId" = staff."schoolId" AND position."code" = 'BEP';

-- Each legacy grant becomes a bound StaffProfile on a dedicated seeded Position.
-- This preserves its effective access without retaining the preset grant at read time.
INSERT INTO "StaffProfile" ("schoolId", "fullName", "email", "phone", "dateOfBirth", "gender", "address", "employmentStatus", "primaryPositionId", "schoolMembershipId", "boundAt", "boundByMembershipId", "updatedAt")
SELECT legacy."schoolId", identity."emailNormalized", identity."emailNormalized", 'Chưa cập nhật', DATE '1900-01-01', 'Chưa cập nhật', 'Chưa cập nhật', 'ACTIVE', position."id", legacy."membershipId", CURRENT_TIMESTAMP, legacy."membershipId", CURRENT_TIMESTAMP
FROM (SELECT "schoolId", "membershipId", CASE WHEN bool_or("role"::text = 'SCHOOL_ADMIN') THEN 'HIEU_TRUONG' WHEN bool_or("role"::text = 'FINANCE_MANAGER') THEN 'KE_TOAN' ELSE 'GIAO_VIEN' END AS position_code FROM "SchoolRoleGrant" GROUP BY "schoolId", "membershipId") legacy
JOIN "SchoolMembership" membership ON membership."id" = legacy."membershipId" AND membership."schoolId" = legacy."schoolId"
JOIN "UserIdentity" identity ON identity."id" = membership."userIdentityId"
JOIN "SchoolPosition" position ON position."schoolId" = legacy."schoolId" AND position."code" = legacy.position_code
WHERE NOT EXISTS (SELECT 1 FROM "StaffProfile" staff WHERE staff."schoolId" = legacy."schoolId" AND staff."schoolMembershipId" = legacy."membershipId");

UPDATE "StaffProfile" staff SET "primaryPositionId" = position."id"
FROM (SELECT "schoolId", "membershipId", CASE WHEN bool_or("role"::text = 'SCHOOL_ADMIN') THEN 'HIEU_TRUONG' WHEN bool_or("role"::text = 'FINANCE_MANAGER') THEN 'KE_TOAN' ELSE 'GIAO_VIEN' END AS position_code FROM "SchoolRoleGrant" GROUP BY "schoolId", "membershipId") legacy
JOIN "SchoolPosition" position ON position."schoolId" = legacy."schoolId" AND position."code" = legacy.position_code
WHERE staff."schoolId" = legacy."schoolId" AND staff."schoolMembershipId" = legacy."membershipId";

INSERT INTO "PositionCapabilityGrant" ("schoolId", "positionId", "capability")
SELECT position."schoolId", position."id", capability
FROM "SchoolPosition" position
CROSS JOIN (VALUES
  ('HIEU_TRUONG', 'SCHOOL_CONTEXT_READ'), ('HIEU_TRUONG', 'ACCESS_MANAGE'), ('HIEU_TRUONG', 'ROSTER_MANAGE'), ('HIEU_TRUONG', 'SETTINGS_MANAGE'), ('HIEU_TRUONG', 'CLASS_LEAVE_READ'),
  ('KE_TOAN', 'SCHOOL_CONTEXT_READ'), ('KE_TOAN', 'SETTINGS_MANAGE'),
  ('GIAO_VIEN', 'SCHOOL_CONTEXT_READ'), ('GIAO_VIEN', 'CLASS_LEAVE_READ')
) AS grants(code, capability)
WHERE position."code" = grants.code
  AND EXISTS (SELECT 1 FROM "SchoolRoleGrant" legacy_grant WHERE legacy_grant."schoolId" = position."schoolId" AND ((position."code" = 'HIEU_TRUONG' AND legacy_grant."role"::text = 'SCHOOL_ADMIN') OR (position."code" = 'KE_TOAN' AND legacy_grant."role"::text = 'FINANCE_MANAGER') OR (position."code" = 'GIAO_VIEN' AND legacy_grant."role"::text = 'CLASS_TEACHER')))
ON CONFLICT ("schoolId", "positionId", "capability") DO NOTHING;
ALTER TABLE "StaffProfile" ALTER COLUMN "primaryPositionId" SET NOT NULL;
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_primary_position_fkey" FOREIGN KEY ("schoolId", "primaryPositionId") REFERENCES "SchoolPosition"("schoolId", "id") ON DELETE RESTRICT;
CREATE INDEX "SchoolPosition_school_status_idx" ON "SchoolPosition"("schoolId", "status");
CREATE INDEX "PositionCapabilityGrant_school_capability_idx" ON "PositionCapabilityGrant"("schoolId", "capability");
ALTER TABLE "StaffProfile" DROP COLUMN "staffType";
DROP TYPE "StaffType";
ALTER TABLE "SchoolRoleGrant" DROP CONSTRAINT "SchoolRoleGrant_schoolId_membershipId_fkey";
DROP TABLE "SchoolRoleGrant";
DROP TYPE "SchoolRole";
