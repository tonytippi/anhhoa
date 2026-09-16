-- Recover typed provenance only where the pre-existing reference is authoritative.
UPDATE "AuditRecord" AS audit
SET "actorType" = 'SCHOOL_MEMBERSHIP',
    "actorReference" = membership."id"::text,
    "actorIdentityId" = membership."userIdentityId"
FROM "SchoolMembership" AS membership
WHERE audit."membershipId" = membership."id"
  AND audit."schoolId" = membership."schoolId"
  AND audit."actorType" IS NULL;

UPDATE "AuditRecord" AS audit
SET "actorType" = 'PLATFORM_OPERATOR_GRANT',
    "actorReference" = operator_grant."id"::text,
    "actorIdentityId" = operator_grant."userIdentityId"
FROM "PlatformOperatorGrant" AS operator_grant
WHERE audit."actorType" IS NULL
  AND audit."provenance" ->> 'platformOperatorGrantId' = operator_grant."id"::text;

-- Rows without either historical reference remain untyped: their original provenance is unrecoverable.
CREATE OR REPLACE FUNCTION "validate_audit_actor_provenance"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."actorType" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."actorType" = 'SCHOOL_MEMBERSHIP' AND EXISTS (
    SELECT 1 FROM "SchoolMembership" AS membership
    WHERE membership."id"::text = NEW."actorReference"
      AND membership."id" = NEW."membershipId"
      AND membership."schoolId" = NEW."schoolId"
      AND membership."userIdentityId" = NEW."actorIdentityId"
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW."actorType" = 'PLATFORM_OPERATOR_GRANT' AND NEW."membershipId" IS NULL AND EXISTS (
    SELECT 1 FROM "PlatformOperatorGrant" AS operator_grant
    WHERE operator_grant."id"::text = NEW."actorReference"
      AND operator_grant."userIdentityId" = NEW."actorIdentityId"
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'AuditRecord actor provenance does not match its typed actor context';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditRecord_validate_actor_provenance" ON "AuditRecord";
CREATE TRIGGER "AuditRecord_validate_actor_provenance"
  BEFORE INSERT OR UPDATE OF "schoolId", "actorIdentityId", "membershipId", "actorType", "actorReference"
  ON "AuditRecord" FOR EACH ROW EXECUTE FUNCTION "validate_audit_actor_provenance"();

DROP INDEX IF EXISTS "Operation_school_idempotency_scope_key";
DROP INDEX IF EXISTS "Operation_platform_idempotency_scope_key";

-- Prisma cannot represent partial-index predicates; these unique scopes are migration-owned.
CREATE UNIQUE INDEX "Operation_school_idempotency_scope_key"
  ON "Operation" ("schoolId", "actorType", "actorReference", "route", "idempotencyKey")
  WHERE "schoolId" IS NOT NULL;

CREATE UNIQUE INDEX "Operation_platform_idempotency_scope_key"
  ON "Operation" ("platformOperatorGrantId", "actorType", "actorReference", "route", "idempotencyKey")
  WHERE "schoolId" IS NULL;
