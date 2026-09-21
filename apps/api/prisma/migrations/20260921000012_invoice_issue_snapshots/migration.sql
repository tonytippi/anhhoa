ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'ISSUED';

ALTER TABLE "Invoice"
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "bankAccountIdSnapshot" UUID,
  ADD COLUMN "receivingBankSnapshot" TEXT,
  ADD COLUMN "accountNumberSnapshot" TEXT,
  ADD COLUMN "accountHolderNameSnapshot" TEXT,
  ADD COLUMN "transferContentSnapshot" TEXT,
  ADD COLUMN "obligationLinesSnapshot" JSONB,
  ADD COLUMN "obligationTotalSnapshot" BIGINT,
  ADD COLUMN "financePolicyEffectiveFrom" DATE,
  ADD COLUMN "dueDaysAfterIssueSnapshot" INTEGER,
  ADD COLUMN "taxTreatmentSnapshot" "FinanceTaxTreatment",
  ADD COLUMN "debtScopeSnapshot" "FinanceDebtScope",
  ADD COLUMN "reversalModeSnapshot" "FinanceReversalMode",
  ADD COLUMN "dueOn" DATE;

CREATE INDEX "Invoice_schoolId_status_idx" ON "Invoice"("schoolId", "status");

CREATE OR REPLACE FUNCTION reject_invoice_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF OLD."schoolId" IS DISTINCT FROM NEW."schoolId"
    OR OLD."studentId" IS DISTINCT FROM NEW."studentId"
    OR OLD."collectionRunId" IS DISTINCT FROM NEW."collectionRunId"
    OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId"
    OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth"
    OR OLD."rosterAsOf" IS DISTINCT FROM NEW."rosterAsOf"
    OR OLD."studentCodeSnapshot" IS DISTINCT FROM NEW."studentCodeSnapshot"
    OR OLD."studentNameSnapshot" IS DISTINCT FROM NEW."studentNameSnapshot"
    OR OLD."enrollmentIdSnapshot" IS DISTINCT FROM NEW."enrollmentIdSnapshot"
    OR OLD."enrollmentLifecycleSnapshot" IS DISTINCT FROM NEW."enrollmentLifecycleSnapshot"
    OR OLD."enrollmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."enrollmentEffectiveFromSnapshot"
    OR OLD."enrollmentEndedOnSnapshot" IS DISTINCT FROM NEW."enrollmentEndedOnSnapshot"
    OR OLD."classAssignmentIdSnapshot" IS DISTINCT FROM NEW."classAssignmentIdSnapshot"
    OR OLD."classAssignmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot"
    OR OLD."classAssignmentEffectiveToSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot"
    OR OLD."classIdSnapshot" IS DISTINCT FROM NEW."classIdSnapshot"
    OR OLD."classNameSnapshot" IS DISTINCT FROM NEW."classNameSnapshot"
    OR OLD."selectionProvenance" IS DISTINCT FROM NEW."selectionProvenance"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION 'Invoice roster snapshots are immutable';
  END IF;
  IF OLD."status" = 'ISSUED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  IF OLD."status" <> 'DRAFT' OR NEW."status" NOT IN ('DRAFT', 'ISSUED') THEN
    RAISE EXCEPTION 'Invalid invoice lifecycle transition';
  END IF;
  IF NEW."status" = 'ISSUED' AND (
    NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL
    OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL
    OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL
    OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL
    OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL
    OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL
  ) THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
