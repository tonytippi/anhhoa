ALTER TABLE "UserIdentity" ADD COLUMN "lastLoginAt" TIMESTAMPTZ(3);
ALTER TABLE "UserIdentity" ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3);

-- Approximate last use before tracking existed from the identity's latest Operation or audit; sign-ins were never recorded.
UPDATE "UserIdentity" u SET "lastSeenAt" = activity.at
FROM (
  SELECT "actorIdentityId" AS id, max("createdAt") AS at FROM (
    SELECT "actorIdentityId", "createdAt" FROM "Operation" WHERE "actorIdentityId" IS NOT NULL
    UNION ALL
    SELECT "actorIdentityId", "createdAt" FROM "AuditRecord" WHERE "actorIdentityId" IS NOT NULL
  ) rows GROUP BY "actorIdentityId"
) activity
WHERE activity.id = u."id";
