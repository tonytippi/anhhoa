CREATE TABLE "SchoolUserAccess" (
  "schoolId" UUID NOT NULL,
  "userIdentityId" UUID NOT NULL,
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SchoolUserAccess_pkey" PRIMARY KEY ("schoolId", "userIdentityId"),
  CONSTRAINT "SchoolUserAccess_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SchoolUserAccess_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Approximate prior use per School from the identity's latest School-scoped Operation or audit.
INSERT INTO "SchoolUserAccess" ("schoolId", "userIdentityId", "lastSeenAt")
SELECT "schoolId", "actorIdentityId", max("createdAt") FROM (
  SELECT "schoolId", "actorIdentityId", "createdAt" FROM "Operation" WHERE "schoolId" IS NOT NULL AND "actorIdentityId" IS NOT NULL AND "actorType" <> 'PLATFORM_OPERATOR_GRANT'
  UNION ALL
  SELECT "schoolId", "actorIdentityId", "createdAt" FROM "AuditRecord" WHERE "actorIdentityId" IS NOT NULL AND ("actorType" IS NULL OR "actorType" <> 'PLATFORM_OPERATOR_GRANT')
) activity GROUP BY "schoolId", "actorIdentityId";
