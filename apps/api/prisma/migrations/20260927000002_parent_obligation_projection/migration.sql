ALTER TABLE "Invoice" ADD COLUMN "obligationCodeSnapshot" TEXT;
CREATE UNIQUE INDEX "Invoice_schoolId_obligationCodeSnapshot_key" ON "Invoice"("schoolId", "obligationCodeSnapshot");

CREATE OR REPLACE FUNCTION reject_obligation_code_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."obligationCodeSnapshot" IS NOT NULL
     AND OLD."obligationCodeSnapshot" IS DISTINCT FROM NEW."obligationCodeSnapshot" THEN
    RAISE EXCEPTION 'Obligation code snapshot is immutable';
  END IF;
  IF NEW."status" = 'ISSUED' AND NEW."obligationCodeSnapshot" IS NULL THEN
    RAISE EXCEPTION 'Issued invoice requires an obligation code snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_obligation_code_snapshot_immutable
BEFORE UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION reject_obligation_code_snapshot_mutation();

CREATE TABLE "ParentAccessPolicyVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "closedRetentionMonths" INTEGER NOT NULL DEFAULT 12,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentAccessPolicyVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentAccessPolicyVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentAccessPolicyVersion_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ParentAccessPolicyVersion_schoolId_effectiveFrom_key" ON "ParentAccessPolicyVersion"("schoolId", "effectiveFrom");
CREATE UNIQUE INDEX "ParentAccessPolicyVersion_schoolId_id_key" ON "ParentAccessPolicyVersion"("schoolId", "id");
CREATE INDEX "ParentAccessPolicyVersion_schoolId_effectiveFrom_idx" ON "ParentAccessPolicyVersion"("schoolId", "effectiveFrom");
