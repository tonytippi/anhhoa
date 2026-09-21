INSERT INTO "PositionCapabilityGrant" ("schoolId", "positionId", "capability")
SELECT "schoolId", "id", 'LEAVE_REQUEST_DECIDE'
FROM "SchoolPosition"
WHERE "code" IN ('HIEU_TRUONG', 'QUAN_LY_TRUONG', 'KE_TOAN')
ON CONFLICT ("schoolId", "positionId", "capability") DO NOTHING;
