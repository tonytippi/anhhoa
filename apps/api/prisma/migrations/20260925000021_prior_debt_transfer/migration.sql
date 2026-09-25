CREATE TYPE "InvoiceLineKind" AS ENUM ('NORMAL', 'PRIOR_DEBT');
ALTER TABLE "InvoiceLine" ADD COLUMN "kind" "InvoiceLineKind" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "InvoiceLine" ALTER COLUMN "receivableId" DROP NOT NULL;

CREATE TABLE "DebtTransfer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "sourceInvoiceId" uuid NOT NULL, "targetInvoiceId" uuid NOT NULL,
  "targetLineId" uuid NOT NULL UNIQUE, "amount" bigint NOT NULL CHECK ("amount" > 0), "reason" text NOT NULL,
  "actorIdentityId" uuid NOT NULL, "membershipId" uuid NOT NULL, "operationId" uuid NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "targetLineId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "targetInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "targetLineId") REFERENCES "InvoiceLine"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "DebtTransfer_schoolId_sourceInvoiceId_idx" ON "DebtTransfer" ("schoolId", "sourceInvoiceId");
CREATE INDEX "DebtTransfer_schoolId_targetInvoiceId_idx" ON "DebtTransfer" ("schoolId", "targetInvoiceId");

CREATE OR REPLACE FUNCTION enforce_prior_debt_transfer() RETURNS trigger AS $$
DECLARE source_invoice "Invoice"; target_invoice "Invoice"; target_line "InvoiceLine"; applied bigint;
BEGIN
  SELECT * INTO source_invoice FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."sourceInvoiceId";
  SELECT * INTO target_invoice FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."targetInvoiceId";
  SELECT * INTO target_line FROM "InvoiceLine" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."targetLineId";
  IF NOT FOUND OR source_invoice."status" <> 'ISSUED' OR target_invoice."status" <> 'DRAFT'
    OR source_invoice."studentId" <> NEW."studentId" OR target_invoice."studentId" <> NEW."studentId"
    OR source_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."schoolYearId" <> NEW."schoolYearId"
    OR target_line."invoiceId" <> NEW."targetInvoiceId" OR target_line."kind" <> 'PRIOR_DEBT'
    OR target_line."receivableId" IS NOT NULL OR target_line."amount" <> NEW."amount"
    OR btrim(NEW."reason") = '' THEN RAISE EXCEPTION 'Prior debt transfer must link an open same-scope source to a draft PRIOR_DEBT target line'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."sourceInvoiceId";
  IF NEW."amount" > source_invoice."obligationTotalSnapshot" - applied THEN RAISE EXCEPTION 'Prior debt transfer exceeds source outstanding'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER debt_transfer_graph_guard BEFORE INSERT ON "DebtTransfer" FOR EACH ROW EXECUTE FUNCTION enforce_prior_debt_transfer();
CREATE TRIGGER debt_transfer_no_update_delete BEFORE UPDATE OR DELETE ON "DebtTransfer" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_append_only();

CREATE OR REPLACE FUNCTION enforce_invoice_line_kind() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NULL; END IF;
  IF NEW."kind" = 'NORMAL' AND NEW."receivableId" IS NULL THEN RAISE EXCEPTION 'Normal invoice lines require a receivable'; END IF;
  IF NEW."kind" = 'PRIOR_DEBT' AND (NEW."receivableId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "targetLineId" = NEW."id")) THEN RAISE EXCEPTION 'PRIOR_DEBT lines require immutable debt transfer provenance'; END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER invoice_line_kind_guard AFTER INSERT OR UPDATE ON "InvoiceLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_kind();

CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger AS $$
DECLARE invoice_row "Invoice"; outstanding bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT invoice_row."obligationTotalSnapshot" - COALESCE(SUM("amount"), 0) INTO outstanding FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."invoiceId";
  IF invoice_row."id" IS NULL OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Receipt must close one issued same-Student same-SchoolYear invoice'; END IF;
  IF NEW."outcome" <> (CASE WHEN NEW."actualAmount" = outstanding THEN 'EXACT'::"SettlementOutcome" WHEN NEW."actualAmount" < outstanding THEN 'SHORTFALL'::"SettlementOutcome" ELSE 'OVERPAYMENT'::"SettlementOutcome" END) THEN RAISE EXCEPTION 'Receipt outcome must be derived from invoice outstanding amount'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_settlement_difference_mutation() RETURNS trigger AS $$
DECLARE receipt_row "Receipt"; invoice_row "Invoice"; outstanding bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement difference is immutable'; END IF;
  SELECT * INTO receipt_row FROM "Receipt" WHERE "id" = NEW."receiptId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT invoice_row."obligationTotalSnapshot" - COALESCE(SUM("amount"), 0) INTO outstanding FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."invoiceId";
  IF invoice_row."id" IS NULL OR receipt_row."id" IS NULL OR receipt_row."invoiceId" <> NEW."invoiceId" OR receipt_row."studentId" <> NEW."studentId" OR receipt_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR NEW."signedAmount" <> receipt_row."actualAmount" - outstanding THEN RAISE EXCEPTION 'Settlement difference must be the non-zero receipt delta for its invoice outstanding'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
