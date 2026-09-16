ALTER TABLE "AuditRecord"
  ADD COLUMN IF NOT EXISTS "actorType" "OperationActorType",
  ADD COLUMN IF NOT EXISTS "actorReference" TEXT;

-- Older deployments may still retain either pre-scope idempotency index.
DROP INDEX IF EXISTS "Operation_schoolId_actorReference_route_fingerprint_key";
DROP INDEX IF EXISTS "Operation_actorReference_route_idempotencyKey_key";

CREATE UNIQUE INDEX "Operation_school_idempotency_scope_key"
  ON "Operation" ("schoolId", "actorReference", "route", "idempotencyKey")
  WHERE "schoolId" IS NOT NULL;

CREATE UNIQUE INDEX "Operation_platform_idempotency_scope_key"
  ON "Operation" ("platformOperatorGrantId", "actorReference", "route", "idempotencyKey")
  WHERE "schoolId" IS NULL;
