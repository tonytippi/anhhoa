-- Every School has the default calendar (Monday to Saturday, no holidays) from the start, so leave and
-- prepaid coverage can always snapshot a calendar version. Backfill Schools provisioned without one.
INSERT INTO "SchoolCalendarVersion" ("id", "schoolId", "effectiveFrom", "actorIdentityId", "membershipId")
SELECT gen_random_uuid(), s."id", DATE '2000-01-01', s."initialOwnerIdentityId", m."id"
FROM "School" s
JOIN "SchoolMembership" m ON m."schoolId" = s."id" AND m."userIdentityId" = s."initialOwnerIdentityId"
WHERE NOT EXISTS (
  SELECT 1 FROM "SchoolCalendarVersion" c WHERE c."schoolId" = s."id" AND c."effectiveFrom" <= DATE '2000-01-01'
);
