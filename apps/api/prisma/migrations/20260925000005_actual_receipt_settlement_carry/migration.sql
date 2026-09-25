ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
CREATE TYPE "SettlementOutcome" AS ENUM ('EXACT', 'SHORTFALL', 'OVERPAYMENT');
CREATE TYPE "SettlementCarryType" AS ENUM ('SHORTFALL_CARRY', 'OVERPAYMENT_CARRY');

CREATE TABLE "Receipt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "invoiceId" uuid NOT NULL, "actualAmount" bigint NOT NULL,
  "outcome" "SettlementOutcome" NOT NULL, "postedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "invoiceId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  CHECK ("actualAmount" >= 0)
);
CREATE INDEX "Receipt_schoolId_studentId_schoolYearId_postedAt_idx" ON "Receipt" ("schoolId", "studentId", "schoolYearId", "postedAt");

CREATE TABLE "SettlementDifference" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "invoiceId" uuid NOT NULL, "receiptId" uuid NOT NULL,
  "signedAmount" bigint NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "invoiceId"), UNIQUE ("schoolId", "receiptId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "receiptId") REFERENCES "Receipt"("schoolId", "id") ON DELETE RESTRICT,
  CHECK ("signedAmount" <> 0)
);
CREATE INDEX "SettlementDifference_schoolId_studentId_schoolYearId_createdAt_idx" ON "SettlementDifference" ("schoolId", "studentId", "schoolYearId", "createdAt");

CREATE TABLE "SettlementCarry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "settlementDifferenceId" uuid NOT NULL, "invoiceId" uuid NOT NULL,
  "type" "SettlementCarryType" NOT NULL, "amount" bigint NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "settlementDifferenceId", "invoiceId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "settlementDifferenceId") REFERENCES "SettlementDifference"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  CHECK ("amount" > 0)
);
CREATE INDEX "SettlementCarry_schoolId_invoiceId_idx" ON "SettlementCarry" ("schoolId", "invoiceId");

CREATE OR REPLACE FUNCTION reject_invoice_snapshot_mutation() RETURNS trigger AS $$
DECLARE issued_local_date DATE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Invoices can only be inserted as DRAFT'; END IF;
  IF NEW."revisesInvoiceId" = NEW."id" THEN RAISE EXCEPTION 'Invoice cannot revise itself'; END IF;
  IF NEW."revisesInvoiceId" IS NULL AND NEW."revisionReason" IS NOT NULL THEN RAISE EXCEPTION 'Normal invoice cannot have a revision reason'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND (NEW."revisionReason" IS NULL OR btrim(NEW."revisionReason") = '') THEN RAISE EXCEPTION 'Invoice revision requires a reason'; END IF;
  IF TG_OP = 'INSERT' AND NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Invoice" source
    WHERE source."id" = NEW."revisesInvoiceId" AND source."schoolId" = NEW."schoolId" AND source."status" = 'ISSUED'
      AND source."revisesInvoiceId" IS NULL AND source."studentId" = NEW."studentId" AND source."collectionRunId" = NEW."collectionRunId"
      AND source."schoolYearId" = NEW."schoolYearId" AND source."billingMonth" = NEW."billingMonth" AND source."rosterAsOf" = NEW."rosterAsOf"
      AND source."studentCodeSnapshot" = NEW."studentCodeSnapshot" AND source."studentNameSnapshot" = NEW."studentNameSnapshot"
      AND source."enrollmentIdSnapshot" = NEW."enrollmentIdSnapshot" AND source."enrollmentLifecycleSnapshot" = NEW."enrollmentLifecycleSnapshot"
      AND source."enrollmentEffectiveFromSnapshot" = NEW."enrollmentEffectiveFromSnapshot" AND source."enrollmentEndedOnSnapshot" IS NOT DISTINCT FROM NEW."enrollmentEndedOnSnapshot"
      AND source."classAssignmentIdSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentIdSnapshot" AND source."classAssignmentEffectiveFromSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot"
      AND source."classAssignmentEffectiveToSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" AND source."classIdSnapshot" = NEW."classIdSnapshot"
      AND source."classNameSnapshot" = NEW."classNameSnapshot" AND source."selectionProvenance" = NEW."selectionProvenance"
  ) THEN RAISE EXCEPTION 'Invoice revision must copy an issued source roster snapshot and provenance'; END IF;
  IF TG_OP <> 'INSERT' AND (
    OLD."schoolId" IS DISTINCT FROM NEW."schoolId" OR OLD."studentId" IS DISTINCT FROM NEW."studentId" OR OLD."collectionRunId" IS DISTINCT FROM NEW."collectionRunId" OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId" OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth" OR OLD."rosterAsOf" IS DISTINCT FROM NEW."rosterAsOf" OR OLD."studentCodeSnapshot" IS DISTINCT FROM NEW."studentCodeSnapshot" OR OLD."studentNameSnapshot" IS DISTINCT FROM NEW."studentNameSnapshot" OR OLD."enrollmentIdSnapshot" IS DISTINCT FROM NEW."enrollmentIdSnapshot" OR OLD."enrollmentLifecycleSnapshot" IS DISTINCT FROM NEW."enrollmentLifecycleSnapshot" OR OLD."enrollmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."enrollmentEffectiveFromSnapshot" OR OLD."enrollmentEndedOnSnapshot" IS DISTINCT FROM NEW."enrollmentEndedOnSnapshot" OR OLD."classAssignmentIdSnapshot" IS DISTINCT FROM NEW."classAssignmentIdSnapshot" OR OLD."classAssignmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot" OR OLD."classAssignmentEffectiveToSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" OR OLD."classIdSnapshot" IS DISTINCT FROM NEW."classIdSnapshot" OR OLD."classNameSnapshot" IS DISTINCT FROM NEW."classNameSnapshot" OR OLD."selectionProvenance" IS DISTINCT FROM NEW."selectionProvenance" OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR OLD."revisesInvoiceId" IS DISTINCT FROM NEW."revisesInvoiceId" OR OLD."revisionReason" IS DISTINCT FROM NEW."revisionReason"
  ) THEN RAISE EXCEPTION 'Invoice roster snapshots and lineage are immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" IN ('CLOSED', 'CANCELLED') THEN RAISE EXCEPTION 'Terminal invoice is immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED' THEN
    IF OLD."total" IS DISTINCT FROM NEW."total" OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" OR OLD."obligationTotalSnapshot" IS DISTINCT FROM NEW."obligationTotalSnapshot" THEN RAISE EXCEPTION 'Close can only change invoice status'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  IF NEW."status" = 'CANCELLED' THEN
    IF OLD."status" <> 'ISSUED' OR NEW."revisesInvoiceId" IS NOT NULL OR OLD."total" IS DISTINCT FROM NEW."total" OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" OR OLD."bankAccountIdSnapshot" IS DISTINCT FROM NEW."bankAccountIdSnapshot" OR OLD."receivingBankSnapshot" IS DISTINCT FROM NEW."receivingBankSnapshot" OR OLD."accountNumberSnapshot" IS DISTINCT FROM NEW."accountNumberSnapshot" OR OLD."accountHolderNameSnapshot" IS DISTINCT FROM NEW."accountHolderNameSnapshot" OR OLD."transferContentSnapshot" IS DISTINCT FROM NEW."transferContentSnapshot" OR OLD."obligationLinesSnapshot" IS DISTINCT FROM NEW."obligationLinesSnapshot" OR OLD."obligationTotalSnapshot" IS DISTINCT FROM NEW."obligationTotalSnapshot" OR OLD."financePolicyEffectiveFrom" IS DISTINCT FROM NEW."financePolicyEffectiveFrom" OR OLD."dueDaysAfterIssueSnapshot" IS DISTINCT FROM NEW."dueDaysAfterIssueSnapshot" OR OLD."taxTreatmentSnapshot" IS DISTINCT FROM NEW."taxTreatmentSnapshot" OR OLD."debtScopeSnapshot" IS DISTINCT FROM NEW."debtScopeSnapshot" OR OLD."reversalModeSnapshot" IS DISTINCT FROM NEW."reversalModeSnapshot" OR OLD."dueOn" IS DISTINCT FROM NEW."dueOn" THEN RAISE EXCEPTION 'Cancellation can only change invoice status'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."status" = 'DRAFT' THEN
    IF NEW."issuedAt" IS NOT NULL OR NEW."bankAccountIdSnapshot" IS NOT NULL OR NEW."receivingBankSnapshot" IS NOT NULL OR NEW."accountNumberSnapshot" IS NOT NULL OR NEW."accountHolderNameSnapshot" IS NOT NULL OR NEW."transferContentSnapshot" IS NOT NULL OR NEW."obligationLinesSnapshot" IS NOT NULL OR NEW."obligationTotalSnapshot" IS NOT NULL OR NEW."financePolicyEffectiveFrom" IS NOT NULL OR NEW."dueDaysAfterIssueSnapshot" IS NOT NULL OR NEW."taxTreatmentSnapshot" IS NOT NULL OR NEW."debtScopeSnapshot" IS NOT NULL OR NEW."reversalModeSnapshot" IS NOT NULL OR NEW."dueOn" IS NOT NULL THEN RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND (OLD."status" <> 'DRAFT' OR NEW."status" <> 'ISSUED') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
  IF NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  issued_local_date := ((NEW."issuedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF NEW."obligationTotalSnapshot" <> NEW."total" OR NEW."dueOn" <> issued_local_date + NEW."dueDaysAfterIssueSnapshot" THEN RAISE EXCEPTION 'Issued invoice snapshots are internally inconsistent'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger AS $$
DECLARE invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NOT FOUND OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Receipt must close one issued same-Student same-SchoolYear invoice'; END IF;
  IF NEW."outcome" <> (CASE WHEN NEW."actualAmount" = invoice_row."obligationTotalSnapshot" THEN 'EXACT'::"SettlementOutcome" WHEN NEW."actualAmount" < invoice_row."obligationTotalSnapshot" THEN 'SHORTFALL'::"SettlementOutcome" ELSE 'OVERPAYMENT'::"SettlementOutcome" END) THEN RAISE EXCEPTION 'Receipt outcome must be derived from invoice amount'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER receipt_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "Receipt" FOR EACH ROW EXECUTE FUNCTION reject_receipt_mutation();

CREATE OR REPLACE FUNCTION reject_settlement_difference_mutation() RETURNS trigger AS $$
DECLARE receipt_row "Receipt";
DECLARE invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement difference is immutable'; END IF;
  SELECT * INTO receipt_row FROM "Receipt" WHERE "id" = NEW."receiptId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NOT FOUND OR receipt_row."invoiceId" <> NEW."invoiceId" OR receipt_row."studentId" <> NEW."studentId" OR receipt_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR NEW."signedAmount" <> receipt_row."actualAmount" - invoice_row."obligationTotalSnapshot" THEN RAISE EXCEPTION 'Settlement difference must be the non-zero receipt delta for its invoice'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER settlement_difference_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "SettlementDifference" FOR EACH ROW EXECUTE FUNCTION reject_settlement_difference_mutation();

CREATE OR REPLACE FUNCTION reject_settlement_carry_mutation() RETURNS trigger AS $$
DECLARE difference_row "SettlementDifference";
DECLARE target_invoice "Invoice";
DECLARE applied bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement carry is immutable'; END IF;
  SELECT * INTO difference_row FROM "SettlementDifference" WHERE "id" = NEW."settlementDifferenceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO target_invoice FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NOT FOUND OR difference_row."studentId" <> NEW."studentId" OR difference_row."schoolYearId" <> NEW."schoolYearId" OR target_invoice."studentId" <> NEW."studentId" OR target_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."status" <> 'DRAFT' OR target_invoice."billingMonth" <= (SELECT "billingMonth" FROM "Invoice" WHERE "id" = difference_row."invoiceId") OR NEW."type" <> (CASE WHEN difference_row."signedAmount" < 0 THEN 'SHORTFALL_CARRY'::"SettlementCarryType" ELSE 'OVERPAYMENT_CARRY'::"SettlementCarryType" END) THEN RAISE EXCEPTION 'Settlement carry must target a later same-Student same-SchoolYear draft'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "SettlementCarry" WHERE "schoolId" = NEW."schoolId" AND "settlementDifferenceId" = NEW."settlementDifferenceId";
  IF NEW."amount" > abs(difference_row."signedAmount") - applied THEN RAISE EXCEPTION 'Settlement carry exceeds source remainder'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER settlement_carry_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "SettlementCarry" FOR EACH ROW EXECUTE FUNCTION reject_settlement_carry_mutation();

CREATE OR REPLACE FUNCTION apply_settlement_carry_to_invoice_total() RETURNS trigger AS $$
DECLARE invoice_status "InvoiceStatus"; delta bigint;
BEGIN
  SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  IF invoice_status <> 'DRAFT' THEN RAISE EXCEPTION 'Carry target must be a draft invoice'; END IF;
  delta := CASE WHEN NEW."type" = 'SHORTFALL_CARRY' THEN NEW."amount" ELSE -NEW."amount" END;
  PERFORM set_config('passionedu.recalculate_invoice_total', 'on', true);
  UPDATE "Invoice" SET "total" = "total" + delta WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF (SELECT "total" FROM "Invoice" WHERE "id" = NEW."invoiceId") < 0 THEN RAISE EXCEPTION 'Carry cannot make invoice total negative'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER settlement_carry_adjusts_draft_invoice AFTER INSERT ON "SettlementCarry" FOR EACH ROW EXECUTE FUNCTION apply_settlement_carry_to_invoice_total();

CREATE OR REPLACE FUNCTION recalculate_invoice_total() RETURNS trigger AS $$
DECLARE target_invoice_id uuid; target_school_id uuid;
BEGIN
  target_invoice_id := COALESCE(NEW."invoiceId", OLD."invoiceId");
  target_school_id := COALESCE(NEW."schoolId", OLD."schoolId");
  PERFORM set_config('passionedu.recalculate_invoice_total', 'on', true);
  UPDATE "Invoice" SET "total" = COALESCE((SELECT SUM("amount") FROM "InvoiceLine" WHERE "schoolId" = target_school_id AND "invoiceId" = target_invoice_id), 0) + COALESCE((SELECT SUM(CASE WHEN "type" = 'SHORTFALL_CARRY' THEN "amount" ELSE -"amount" END) FROM "SettlementCarry" WHERE "schoolId" = target_school_id AND "invoiceId" = target_invoice_id), 0)
  WHERE "schoolId" = target_school_id AND "id" = target_invoice_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
