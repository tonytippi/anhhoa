CREATE TYPE "ReceivableStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "ReceivableGroup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivableGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivableGroup_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "ReceivableGroup_schoolId_name_key" UNIQUE ("schoolId", "name"),
  CONSTRAINT "ReceivableGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE INDEX "ReceivableGroup_schoolId_createdAt_idx" ON "ReceivableGroup"("schoolId", "createdAt");

CREATE TABLE "Receivable" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "groupId" UUID NOT NULL,
  "code" TEXT, "displayName" TEXT NOT NULL, "unitLabel" TEXT NOT NULL, "defaultUnitPrice" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id"), CONSTRAINT "Receivable_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "Receivable_defaultUnitPrice_positive" CHECK ("defaultUnitPrice" > 0),
  CONSTRAINT "Receivable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "Receivable_group_graph_fkey" FOREIGN KEY ("schoolId", "groupId") REFERENCES "ReceivableGroup"("schoolId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Receivable_school_code_unique" ON "Receivable"("schoolId", "code") WHERE "code" IS NOT NULL;
CREATE INDEX "Receivable_schoolId_groupId_idx" ON "Receivable"("schoolId", "groupId");

CREATE TABLE "ReceivableGroupLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "receivableGroupId" UUID NOT NULL,
  "previousStatus" "ReceivableStatus", "status" "ReceivableStatus" NOT NULL, "reason" TEXT,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "operationId" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivableGroupLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivableGroupLifecycleTransition_scope_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "ReceivableGroupLifecycleTransition_sequence_key" UNIQUE ("schoolId", "receivableGroupId", "sequence"),
  CONSTRAINT "ReceivableGroupLifecycleTransition_group_fkey" FOREIGN KEY ("schoolId", "receivableGroupId") REFERENCES "ReceivableGroup"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableGroupLifecycleTransition_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableGroupLifecycleTransition_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableGroupLifecycleTransition_valid" CHECK (("previousStatus" IS NULL AND "status" = 'ACTIVE' AND "reason" IS NULL) OR ("previousStatus" IS NOT NULL AND "previousStatus" <> "status" AND length(trim("reason")) > 0))
);

CREATE TABLE "ReceivableLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "receivableId" UUID NOT NULL,
  "previousStatus" "ReceivableStatus", "status" "ReceivableStatus" NOT NULL, "reason" TEXT,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "operationId" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivableLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivableLifecycleTransition_scope_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "ReceivableLifecycleTransition_sequence_key" UNIQUE ("schoolId", "receivableId", "sequence"),
  CONSTRAINT "ReceivableLifecycleTransition_receivable_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableLifecycleTransition_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableLifecycleTransition_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReceivableLifecycleTransition_valid" CHECK (("previousStatus" IS NULL AND "status" = 'ACTIVE' AND "reason" IS NULL) OR ("previousStatus" IS NOT NULL AND "previousStatus" <> "status" AND length(trim("reason")) > 0))
);
CREATE TRIGGER receivable_group_append_only BEFORE UPDATE OR DELETE ON "ReceivableGroup" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER receivable_append_only BEFORE UPDATE OR DELETE ON "Receivable" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER receivable_group_transition_append_only BEFORE UPDATE OR DELETE ON "ReceivableGroupLifecycleTransition" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER receivable_transition_append_only BEFORE UPDATE OR DELETE ON "ReceivableLifecycleTransition" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();

INSERT INTO "PositionCapabilityGrant" ("id", "schoolId", "positionId", "capability", "createdAt")
SELECT gen_random_uuid(), position."schoolId", position."id", 'FINANCE_MANAGE', CURRENT_TIMESTAMP
FROM "SchoolPosition" position
WHERE position."code" IN ('HIEU_TRUONG', 'KE_TOAN')
ON CONFLICT ("schoolId", "positionId", "capability") DO NOTHING;
