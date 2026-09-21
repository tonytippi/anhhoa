CREATE TABLE "CollectionRunLifecycleTransition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "collectionRunId" UUID NOT NULL,
  "previousStatus" "CollectionRunStatus", "status" "CollectionRunStatus" NOT NULL,
  "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL, "operationId" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionRunLifecycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunLifecycleTransition_scope_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRunLifecycleTransition_sequence_key" UNIQUE ("schoolId", "collectionRunId", "sequence"),
  CONSTRAINT "CollectionRunLifecycleTransition_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunLifecycleTransition_membership_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunLifecycleTransition_operation_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunLifecycleTransition_valid" CHECK (("previousStatus" IS NULL AND "status" = 'DRAFT') OR ("previousStatus" = 'DRAFT' AND "status" = 'READY'))
);
CREATE INDEX "CollectionRunLifecycleTransition_schoolId_collectionRunId_sequence_idx" ON "CollectionRunLifecycleTransition"("schoolId", "collectionRunId", "sequence");
CREATE INDEX "CollectionRunLifecycleTransition_schoolId_operationId_idx" ON "CollectionRunLifecycleTransition"("schoolId", "operationId");
CREATE TRIGGER collection_run_transition_append_only BEFORE UPDATE OR DELETE ON "CollectionRunLifecycleTransition" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
