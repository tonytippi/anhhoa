-- Decision 2026-10-01 D7-D8: an issued Invoice may be negative (the School owes the parent). It is
-- closed by exactly one payout of the whole amount, never by a Receipt; a zero Invoice closes at issue.
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'CASH');
ALTER TYPE "FinanceLedgerEventType" ADD VALUE 'PAYOUT_POSTED';

CREATE TABLE "InvoicePayout" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "amount" BIGINT NOT NULL,
  "paidOn" DATE NOT NULL,
  "method" "PayoutMethod" NOT NULL,
  "reference" TEXT NOT NULL,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "postedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoicePayout_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "InvoicePayout_reference_present" CHECK (length(btrim("reference")) > 0)
);
CREATE UNIQUE INDEX "InvoicePayout_schoolId_id_key" ON "InvoicePayout"("schoolId", "id");
CREATE UNIQUE INDEX "InvoicePayout_schoolId_invoiceId_key" ON "InvoicePayout"("schoolId", "invoiceId");
CREATE INDEX "InvoicePayout_schoolId_postedAt_idx" ON "InvoicePayout"("schoolId", "postedAt");
ALTER TABLE "InvoicePayout" ADD CONSTRAINT "InvoicePayout_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePayout" ADD CONSTRAINT "InvoicePayout_schoolId_invoiceId_fkey" FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePayout" ADD CONSTRAINT "InvoicePayout_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePayout" ADD CONSTRAINT "InvoicePayout_schoolId_schoolYearId_fkey" FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_invoice_payout_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Invoice payout is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF invoice_row."id" IS NULL OR invoice_row."status" <> 'ISSUED' OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" THEN
    RAISE EXCEPTION 'Payout must close one issued same-Student same-SchoolYear invoice';
  END IF;
  IF invoice_row."obligationTotalSnapshot" IS NULL OR invoice_row."obligationTotalSnapshot" >= 0 OR NEW."amount" <> -invoice_row."obligationTotalSnapshot" THEN
    RAISE EXCEPTION 'Payout must equal the whole refund owed by a negative invoice';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_payout_immutable_and_exact BEFORE INSERT OR UPDATE OR DELETE ON "InvoicePayout" FOR EACH ROW EXECUTE FUNCTION reject_invoice_payout_mutation();

-- A negative obligation is never closed by a Receipt.
CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_row "Invoice"; outstanding bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT invoice_row."obligationTotalSnapshot" - COALESCE(SUM("amount"), 0) INTO outstanding FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."invoiceId";
  IF invoice_row."id" IS NULL OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Receipt must close one issued same-Student same-SchoolYear invoice'; END IF;
  IF invoice_row."obligationTotalSnapshot" < 0 THEN RAISE EXCEPTION 'A negative invoice is closed by a payout, not a Receipt'; END IF;
  IF NEW."outcome" <> (CASE WHEN NEW."actualAmount" = outstanding THEN 'EXACT'::"SettlementOutcome" WHEN NEW."actualAmount" < outstanding THEN 'SHORTFALL'::"SettlementOutcome" ELSE 'OVERPAYMENT'::"SettlementOutcome" END) THEN RAISE EXCEPTION 'Receipt outcome must be derived from invoice outstanding amount'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_closed_invoice_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED'
    AND NOT EXISTS (SELECT 1 FROM "Receipt" WHERE "schoolId" = NEW."schoolId" AND "invoiceId" = NEW."id")
    AND NOT EXISTS (SELECT 1 FROM "SettlementTransfer" WHERE "schoolId" = NEW."schoolId" AND "replacementInvoiceId" = NEW."id")
    AND NOT EXISTS (SELECT 1 FROM "InvoicePayout" WHERE "schoolId" = NEW."schoolId" AND "invoiceId" = NEW."id") THEN
    RAISE EXCEPTION 'A CLOSED Invoice requires its Receipt, payout or settlement transfer in the same transaction';
  END IF;
  RETURN NEW;
END;
$$;

-- Deductions may already have made a DRAFT negative; only an overpayment carry may not push it further below zero.
CREATE OR REPLACE FUNCTION apply_settlement_carry_to_invoice_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status "InvoiceStatus"; delta bigint;
BEGIN
  SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  IF invoice_status <> 'DRAFT' THEN RAISE EXCEPTION 'Carry target must be a draft invoice'; END IF;
  delta := CASE WHEN NEW."type" = 'SHORTFALL_CARRY' THEN NEW."amount" ELSE -NEW."amount" END;
  PERFORM set_config('passionedu.recalculate_invoice_total', 'on', true);
  UPDATE "Invoice" SET "total" = "total" + delta WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NEW."type" = 'OVERPAYMENT_CARRY' AND (SELECT "total" FROM "Invoice" WHERE "id" = NEW."invoiceId") < 0 THEN RAISE EXCEPTION 'Carry cannot make invoice total negative'; END IF;
  RETURN NEW;
END;
$$;
