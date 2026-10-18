-- Sprint change 2026-10-17 (sprint-change-proposal-2026-10-17-invoice-approval.md): per-Invoice approval history,
-- the receiving account resolved at submission, the run ZIP of payment images, and the guards of the new status.

-- CreateEnum
CREATE TYPE "InvoiceApprovalEventKind" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'RETURNED', 'APPROVED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "approvalBankAccountId" UUID;

-- CreateTable
CREATE TABLE "InvoiceApprovalEvent" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "kind" "InvoiceApprovalEventKind" NOT NULL,
    "membershipId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceApprovalEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvoiceApprovalEvent_note_check" CHECK (("kind" = 'RETURNED') = ("note" IS NOT NULL) AND ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 1000))
);

-- CreateTable
CREATE TABLE "InvoiceImageExport" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "collectionRunId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "zip" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMPTZ(3),

    CONSTRAINT "InvoiceImageExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceApprovalEvent_schoolId_invoiceId_createdAt_idx" ON "InvoiceApprovalEvent"("schoolId", "invoiceId", "createdAt");
CREATE UNIQUE INDEX "InvoiceApprovalEvent_schoolId_id_key" ON "InvoiceApprovalEvent"("schoolId", "id");
CREATE INDEX "InvoiceImageExport_schoolId_expiresAt_idx" ON "InvoiceImageExport"("schoolId", "expiresAt");
CREATE UNIQUE INDEX "InvoiceImageExport_schoolId_id_key" ON "InvoiceImageExport"("schoolId", "id");
CREATE UNIQUE INDEX "InvoiceImageExport_schoolId_operationId_key" ON "InvoiceImageExport"("schoolId", "operationId");

-- AddForeignKey
ALTER TABLE "InvoiceApprovalEvent" ADD CONSTRAINT "InvoiceApprovalEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceApprovalEvent" ADD CONSTRAINT "InvoiceApprovalEvent_schoolId_invoiceId_fkey" FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceApprovalEvent" ADD CONSTRAINT "InvoiceApprovalEvent_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceApprovalEvent" ADD CONSTRAINT "InvoiceApprovalEvent_schoolId_operationId_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceImageExport" ADD CONSTRAINT "InvoiceImageExport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceImageExport" ADD CONSTRAINT "InvoiceImageExport_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceImageExport" ADD CONSTRAINT "InvoiceImageExport_schoolId_operationId_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Approval history is append-only.
CREATE OR REPLACE FUNCTION reject_invoice_approval_event_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'Invoice approval history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_approval_event_append_only BEFORE UPDATE OR DELETE ON "InvoiceApprovalEvent" FOR EACH ROW EXECUTE FUNCTION reject_invoice_approval_event_mutation();

-- Previous latest definition: 20261008000006_discard_draft_revision_guard_repair.
CREATE OR REPLACE FUNCTION public.reject_invoice_snapshot_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE issued_local_date DATE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  -- Decision 2026-10-08: a revision DRAFT was never issued and never changed its source, so Finance may discard it.
  IF TG_OP = 'DELETE' AND OLD."status" = 'DRAFT' AND OLD."revisesInvoiceId" IS NOT NULL THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Invoices can only be inserted as DRAFT'; END IF;
  IF NEW."revisesInvoiceId" = NEW."id" THEN RAISE EXCEPTION 'Invoice cannot revise itself'; END IF;
  IF NEW."revisesInvoiceId" IS NULL AND NEW."revisionReason" IS NOT NULL THEN RAISE EXCEPTION 'Normal invoice cannot have a revision reason'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND (NEW."revisionReason" IS NULL OR btrim(NEW."revisionReason") = '') THEN RAISE EXCEPTION 'Invoice revision requires a reason'; END IF;
  IF TG_OP = 'INSERT' AND NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Invoice" source WHERE source."id" = NEW."revisesInvoiceId" AND source."schoolId" = NEW."schoolId" AND source."status" IN ('ISSUED', 'CLOSED') AND source."revisesInvoiceId" IS NULL AND source."studentId" = NEW."studentId" AND source."collectionRunId" = NEW."collectionRunId" AND source."schoolYearId" = NEW."schoolYearId" AND source."billingMonth" = NEW."billingMonth" AND source."rosterAsOf" = NEW."rosterAsOf" AND source."studentCodeSnapshot" = NEW."studentCodeSnapshot" AND source."studentNameSnapshot" = NEW."studentNameSnapshot" AND source."enrollmentIdSnapshot" = NEW."enrollmentIdSnapshot" AND source."enrollmentLifecycleSnapshot" = NEW."enrollmentLifecycleSnapshot" AND source."enrollmentEffectiveFromSnapshot" = NEW."enrollmentEffectiveFromSnapshot" AND source."enrollmentEndedOnSnapshot" IS NOT DISTINCT FROM NEW."enrollmentEndedOnSnapshot" AND source."classAssignmentIdSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentIdSnapshot" AND source."classAssignmentEffectiveFromSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot" AND source."classAssignmentEffectiveToSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" AND source."classIdSnapshot" IS NOT DISTINCT FROM NEW."classIdSnapshot" AND source."classNameSnapshot" IS NOT DISTINCT FROM NEW."classNameSnapshot" AND source."selectionProvenance" = NEW."selectionProvenance") THEN RAISE EXCEPTION 'Invoice revision must copy an issued or closed source roster snapshot and provenance'; END IF;
  IF TG_OP <> 'INSERT' AND (OLD."schoolId", OLD."studentId", OLD."collectionRunId", OLD."schoolYearId", OLD."billingMonth", OLD."rosterAsOf", OLD."studentCodeSnapshot", OLD."studentNameSnapshot", OLD."enrollmentIdSnapshot", OLD."enrollmentLifecycleSnapshot", OLD."enrollmentEffectiveFromSnapshot", OLD."enrollmentEndedOnSnapshot", OLD."classAssignmentIdSnapshot", OLD."classAssignmentEffectiveFromSnapshot", OLD."classAssignmentEffectiveToSnapshot", OLD."classIdSnapshot", OLD."classNameSnapshot", OLD."selectionProvenance", OLD."createdAt", OLD."revisesInvoiceId", OLD."revisionReason") IS DISTINCT FROM (NEW."schoolId", NEW."studentId", NEW."collectionRunId", NEW."schoolYearId", NEW."billingMonth", NEW."rosterAsOf", NEW."studentCodeSnapshot", NEW."studentNameSnapshot", NEW."enrollmentIdSnapshot", NEW."enrollmentLifecycleSnapshot", NEW."enrollmentEffectiveFromSnapshot", NEW."enrollmentEndedOnSnapshot", NEW."classAssignmentIdSnapshot", NEW."classAssignmentEffectiveFromSnapshot", NEW."classAssignmentEffectiveToSnapshot", NEW."classIdSnapshot", NEW."classNameSnapshot", NEW."selectionProvenance", NEW."createdAt", NEW."revisesInvoiceId", NEW."revisionReason") THEN RAISE EXCEPTION 'Invoice roster snapshots and lineage are immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'CLOSED' AND NEW."status" = 'CANCELLED' THEN
    IF ROW(OLD."schoolId", OLD."studentId", OLD."collectionRunId", OLD."schoolYearId", OLD."billingMonth", OLD."rosterAsOf", OLD."studentCodeSnapshot", OLD."studentNameSnapshot", OLD."enrollmentIdSnapshot", OLD."enrollmentLifecycleSnapshot", OLD."enrollmentEffectiveFromSnapshot", OLD."enrollmentEndedOnSnapshot", OLD."classAssignmentIdSnapshot", OLD."classAssignmentEffectiveFromSnapshot", OLD."classAssignmentEffectiveToSnapshot", OLD."classIdSnapshot", OLD."classNameSnapshot", OLD."selectionProvenance", OLD."total", OLD."issuedAt", OLD."bankAccountIdSnapshot", OLD."receivingBankSnapshot", OLD."accountNumberSnapshot", OLD."accountHolderNameSnapshot", OLD."transferContentSnapshot", OLD."obligationLinesSnapshot", OLD."obligationTotalSnapshot", OLD."financePolicyEffectiveFrom", OLD."dueDaysAfterIssueSnapshot", OLD."taxTreatmentSnapshot", OLD."debtScopeSnapshot", OLD."reversalModeSnapshot", OLD."dueOn", OLD."revisesInvoiceId", OLD."revisionReason", OLD."createdAt") IS DISTINCT FROM ROW(NEW."schoolId", NEW."studentId", NEW."collectionRunId", NEW."schoolYearId", NEW."billingMonth", NEW."rosterAsOf", NEW."studentCodeSnapshot", NEW."studentNameSnapshot", NEW."enrollmentIdSnapshot", NEW."enrollmentLifecycleSnapshot", NEW."enrollmentEffectiveFromSnapshot", NEW."enrollmentEndedOnSnapshot", NEW."classAssignmentIdSnapshot", NEW."classAssignmentEffectiveFromSnapshot", NEW."classAssignmentEffectiveToSnapshot", NEW."classIdSnapshot", NEW."classNameSnapshot", NEW."selectionProvenance", NEW."total", NEW."issuedAt", NEW."bankAccountIdSnapshot", NEW."receivingBankSnapshot", NEW."accountNumberSnapshot", NEW."accountHolderNameSnapshot", NEW."transferContentSnapshot", NEW."obligationLinesSnapshot", NEW."obligationTotalSnapshot", NEW."financePolicyEffectiveFrom", NEW."dueDaysAfterIssueSnapshot", NEW."taxTreatmentSnapshot", NEW."debtScopeSnapshot", NEW."reversalModeSnapshot", NEW."dueOn", NEW."revisesInvoiceId", NEW."revisionReason", NEW."createdAt") THEN RAISE EXCEPTION 'Closed correction cancellation can only change status'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" IN ('CLOSED', 'CANCELLED') THEN RAISE EXCEPTION 'Terminal invoice is immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED' THEN RETURN NEW; END IF;
  IF NEW."status" = 'CANCELLED' THEN IF OLD."status" <> 'ISSUED' OR NEW."revisesInvoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Cancellation requires a source invoice'; END IF; RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  -- Sprint change 2026-10-17: DRAFT -> PENDING_APPROVAL -> ISSUED; withdraw and return go back to DRAFT.
  IF NEW."status" = 'DRAFT' THEN
    IF TG_OP <> 'INSERT' AND OLD."status" NOT IN ('DRAFT', 'PENDING_APPROVAL') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
    IF NEW."approvalBankAccountId" IS NOT NULL THEN RAISE EXCEPTION 'Draft invoice cannot hold an approval bank account'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."status" = 'PENDING_APPROVAL' THEN
    IF TG_OP = 'INSERT' OR OLD."status" NOT IN ('DRAFT', 'PENDING_APPROVAL') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
    IF OLD."status" = 'PENDING_APPROVAL' AND (OLD."total", OLD."channel", OLD."kind", OLD."approvalBankAccountId") IS DISTINCT FROM (NEW."total", NEW."channel", NEW."kind", NEW."approvalBankAccountId") THEN RAISE EXCEPTION 'Invoice pending approval is locked'; END IF;
    IF NEW."approvalBankAccountId" IS NULL OR NOT EXISTS (SELECT 1 FROM "BankAccount" WHERE "id" = NEW."approvalBankAccountId" AND "schoolId" = NEW."schoolId" AND "kind" = NEW."channel") THEN RAISE EXCEPTION 'Invoice pending approval requires a bank account of its school and payment channel'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR OLD."status" <> 'PENDING_APPROVAL' OR NEW."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Invoice is issued only by approving it'; END IF;
  IF NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  issued_local_date := (NEW."issuedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF NEW."obligationTotalSnapshot" <> NEW."total" OR NEW."dueOn" <> issued_local_date + NEW."dueDaysAfterIssueSnapshot" THEN RAISE EXCEPTION 'Issued invoice snapshots are internally inconsistent'; END IF;
  RETURN NEW;
END;
$function$;

-- Previous latest definition: 20260925000015_draft_invoice_snapshot_guard. A pending Invoice is not issued yet either.
CREATE OR REPLACE FUNCTION enforce_draft_invoice_snapshot_empty() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."status" IN ('DRAFT', 'PENDING_APPROVAL') AND (NEW."issuedAt" IS NOT NULL OR NEW."bankAccountIdSnapshot" IS NOT NULL OR NEW."receivingBankSnapshot" IS NOT NULL OR NEW."accountNumberSnapshot" IS NOT NULL OR NEW."accountHolderNameSnapshot" IS NOT NULL OR NEW."transferContentSnapshot" IS NOT NULL OR NEW."obligationLinesSnapshot" IS NOT NULL OR NEW."obligationTotalSnapshot" IS NOT NULL OR NEW."financePolicyEffectiveFrom" IS NOT NULL OR NEW."dueDaysAfterIssueSnapshot" IS NOT NULL OR NEW."taxTreatmentSnapshot" IS NOT NULL OR NEW."debtScopeSnapshot" IS NOT NULL OR NEW."reversalModeSnapshot" IS NOT NULL OR NEW."dueOn" IS NOT NULL) THEN
    RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Previous latest definition: 20260929000000_vietqr_bank_bin. The BIN is snapshotted when a pending Invoice is issued.
CREATE OR REPLACE FUNCTION enforce_invoice_bank_bin_snapshot() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."status" IN ('DRAFT', 'PENDING_APPROVAL') THEN
    IF NEW."receivingBankBinSnapshot" IS NOT NULL THEN
      RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" NOT IN ('DRAFT', 'PENDING_APPROVAL') THEN
    IF OLD."receivingBankBinSnapshot" IS DISTINCT FROM NEW."receivingBankBinSnapshot" THEN
      RAISE EXCEPTION 'Invoice bank BIN snapshot is immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."receivingBankBinSnapshot" IS NULL OR NEW."receivingBankBinSnapshot" IS DISTINCT FROM (
    SELECT "bankBin" FROM "BankAccount" WHERE "id" = NEW."bankAccountIdSnapshot" AND "schoolId" = NEW."schoolId"
  ) THEN
    RAISE EXCEPTION 'Issued invoice requires the bank BIN of its BankAccount snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Previous latest definition: 20261008000007_close_run_with_issued_invoices. Approval is the issue step now.
CREATE OR REPLACE FUNCTION reject_invoice_for_closed_collection_run() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus"; school_year_closed_at TIMESTAMPTZ;
BEGIN
  SELECT "status" INTO run_status FROM "CollectionRun"
  WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."collectionRunId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CollectionRun does not exist for Invoice';
  END IF;
  IF run_status = 'CLOSED' THEN
    -- The only change allowed after the lock is settlement: a Receipt or payout moves an ISSUED Invoice to CLOSED.
    IF TG_OP = 'UPDATE' AND OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED'
      AND OLD."schoolId" = NEW."schoolId" AND OLD."collectionRunId" = NEW."collectionRunId" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot mutate Invoice for CLOSED CollectionRun';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING_APPROVAL' AND NEW."status" = 'ISSUED' AND NEW."revisesInvoiceId" IS NULL THEN
    SELECT "closedAt" INTO school_year_closed_at FROM "SchoolYear"
    WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."schoolYearId"
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SchoolYear does not exist for Invoice';
    END IF;
    IF school_year_closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot issue normal Invoice for CLOSED SchoolYear';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
