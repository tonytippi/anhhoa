ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Invoice" ADD COLUMN "revisesInvoiceId" UUID;
ALTER TABLE "Invoice" ADD COLUMN "revisionReason" TEXT;
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_schoolId_studentId_collectionRunId_key";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_student_run_unique";
CREATE UNIQUE INDEX "Invoice_normal_per_student_run_key"
  ON "Invoice" ("schoolId", "studentId", "collectionRunId")
  WHERE "revisesInvoiceId" IS NULL;
CREATE UNIQUE INDEX "Invoice_replacement_per_source_key"
  ON "Invoice" ("schoolId", "revisesInvoiceId")
  WHERE "revisesInvoiceId" IS NOT NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_revision_same_school_fkey"
  FOREIGN KEY ("schoolId", "revisesInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION reject_invoice_snapshot_mutation() RETURNS trigger AS $$
DECLARE issued_local_date DATE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF TG_OP <> 'INSERT' AND (
    OLD."schoolId" IS DISTINCT FROM NEW."schoolId" OR OLD."studentId" IS DISTINCT FROM NEW."studentId" OR OLD."collectionRunId" IS DISTINCT FROM NEW."collectionRunId"
    OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId" OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth" OR OLD."rosterAsOf" IS DISTINCT FROM NEW."rosterAsOf"
    OR OLD."studentCodeSnapshot" IS DISTINCT FROM NEW."studentCodeSnapshot" OR OLD."studentNameSnapshot" IS DISTINCT FROM NEW."studentNameSnapshot"
    OR OLD."enrollmentIdSnapshot" IS DISTINCT FROM NEW."enrollmentIdSnapshot" OR OLD."enrollmentLifecycleSnapshot" IS DISTINCT FROM NEW."enrollmentLifecycleSnapshot"
    OR OLD."enrollmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."enrollmentEffectiveFromSnapshot" OR OLD."enrollmentEndedOnSnapshot" IS DISTINCT FROM NEW."enrollmentEndedOnSnapshot"
    OR OLD."classAssignmentIdSnapshot" IS DISTINCT FROM NEW."classAssignmentIdSnapshot" OR OLD."classAssignmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot"
    OR OLD."classAssignmentEffectiveToSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" OR OLD."classIdSnapshot" IS DISTINCT FROM NEW."classIdSnapshot"
    OR OLD."classNameSnapshot" IS DISTINCT FROM NEW."classNameSnapshot" OR OLD."selectionProvenance" IS DISTINCT FROM NEW."selectionProvenance"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR OLD."revisesInvoiceId" IS DISTINCT FROM NEW."revisesInvoiceId" OR OLD."revisionReason" IS DISTINCT FROM NEW."revisionReason"
  ) THEN RAISE EXCEPTION 'Invoice roster snapshots and lineage are immutable'; END IF;
  IF NEW."revisesInvoiceId" = NEW."id" THEN RAISE EXCEPTION 'Invoice cannot revise itself'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Invoice" source WHERE source."id" = NEW."revisesInvoiceId" AND source."schoolId" = NEW."schoolId"
      AND source."studentId" = NEW."studentId" AND source."collectionRunId" = NEW."collectionRunId" AND source."revisesInvoiceId" IS NULL
  ) THEN RAISE EXCEPTION 'Invoice revision must reference the normal same-graph source'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND (NEW."revisionReason" IS NULL OR btrim(NEW."revisionReason") = '') THEN RAISE EXCEPTION 'Invoice revision requires a reason'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' AND NEW."status" <> 'CANCELLED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'CANCELLED' THEN RAISE EXCEPTION 'Cancelled invoice is immutable'; END IF;
  IF NEW."status" = 'CANCELLED' THEN
    IF OLD."status" <> 'ISSUED' OR NEW."revisesInvoiceId" IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM "Invoice" replacement WHERE replacement."schoolId" = NEW."schoolId" AND replacement."revisesInvoiceId" = NEW."id" AND replacement."status" = 'ISSUED'
    ) THEN RAISE EXCEPTION 'Only an issued source with an issued replacement can be cancelled'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."status" = 'DRAFT' THEN
    IF NEW."issuedAt" IS NOT NULL OR NEW."bankAccountIdSnapshot" IS NOT NULL OR NEW."obligationLinesSnapshot" IS NOT NULL THEN RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND (OLD."status" <> 'DRAFT' OR NEW."status" <> 'ISSUED') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
  IF NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  issued_local_date := ((NEW."issuedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF NEW."obligationTotalSnapshot" <> NEW."total" OR NEW."dueOn" <> issued_local_date + NEW."dueDaysAfterIssueSnapshot" THEN RAISE EXCEPTION 'Issued invoice snapshots are internally inconsistent'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_snapshot_immutable ON "Invoice";
CREATE TRIGGER invoice_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION reject_invoice_snapshot_mutation();

CREATE OR REPLACE FUNCTION enforce_invoice_revision_completion() RETURNS trigger AS $$
DECLARE replacement "Invoice"%ROWTYPE; source "Invoice"%ROWTYPE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NULL; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND NEW."status" = 'ISSUED' THEN
    SELECT * INTO source FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."revisesInvoiceId";
    IF NOT FOUND OR source."status" <> 'CANCELLED' THEN RAISE EXCEPTION 'Issued replacement requires its source to be cancelled atomically'; END IF;
  END IF;
  IF NEW."status" = 'CANCELLED' THEN
    SELECT * INTO replacement FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "revisesInvoiceId" = NEW."id";
    IF NOT FOUND OR replacement."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Cancelled source requires its issued replacement'; END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER invoice_revision_completion
AFTER INSERT OR UPDATE OF "status" ON "Invoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_revision_completion();

CREATE OR REPLACE FUNCTION enforce_collection_run_close_finality() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND (OLD."schoolId" IS DISTINCT FROM NEW."schoolId" OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId" OR OLD."type" IS DISTINCT FROM NEW."type" OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth" OR OLD."status" IS DISTINCT FROM NEW."status" OR OLD."version" IS DISTINCT FROM NEW."version" OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt") THEN RAISE EXCEPTION 'CLOSED CollectionRun business data is immutable'; END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" <> 'GENERATED' THEN RAISE EXCEPTION 'CollectionRun can transition to CLOSED only from GENERATED'; END IF;
  IF NEW."status" = 'CLOSED' AND EXISTS (SELECT 1 FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" NOT IN ('ISSUED', 'CANCELLED')) THEN RAISE EXCEPTION 'Cannot close CollectionRun with non-terminal invoices'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
