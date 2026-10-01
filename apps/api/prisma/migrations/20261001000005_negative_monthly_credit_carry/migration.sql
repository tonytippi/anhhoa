-- Amendment 2026-10-01 A4 (replaces A2): a negative monthly Invoice is issued and closed at issue by a zero
-- Receipt; the overpayment difference carries into the next monthly DRAFT. Only a settlement Invoice is
-- paid back by a payout, and a settlement may absorb a pending credit below zero.
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_negative_total_settlement_only";

CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_row "Invoice"; outstanding bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT invoice_row."obligationTotalSnapshot" - COALESCE(SUM("amount"), 0) INTO outstanding FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."invoiceId";
  IF invoice_row."id" IS NULL OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Receipt must close one issued same-Student same-SchoolYear invoice'; END IF;
  IF invoice_row."obligationTotalSnapshot" < 0 AND invoice_row."kind" = 'SETTLEMENT' THEN RAISE EXCEPTION 'A negative settlement invoice is closed by a payout, not a Receipt'; END IF;
  IF invoice_row."obligationTotalSnapshot" < 0 AND NEW."actualAmount" <> 0 THEN RAISE EXCEPTION 'A negative monthly invoice closes with a zero Receipt and carries its credit'; END IF;
  IF NEW."outcome" <> (CASE WHEN NEW."actualAmount" = outstanding THEN 'EXACT'::"SettlementOutcome" WHEN NEW."actualAmount" < outstanding THEN 'SHORTFALL'::"SettlementOutcome" ELSE 'OVERPAYMENT'::"SettlementOutcome" END) THEN RAISE EXCEPTION 'Receipt outcome must be derived from invoice outstanding amount'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reject_invoice_payout_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Invoice payout is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF invoice_row."id" IS NULL OR invoice_row."status" <> 'ISSUED' OR invoice_row."kind" <> 'SETTLEMENT' OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" THEN
    RAISE EXCEPTION 'Payout must close one issued same-Student same-SchoolYear settlement invoice';
  END IF;
  IF invoice_row."obligationTotalSnapshot" IS NULL OR invoice_row."obligationTotalSnapshot" >= 0 OR NEW."amount" <> -invoice_row."obligationTotalSnapshot" THEN
    RAISE EXCEPTION 'Payout must equal the whole refund owed by a negative invoice';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION apply_settlement_carry_to_invoice_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_status "InvoiceStatus"; invoice_kind "InvoiceKind"; delta bigint;
BEGIN
  SELECT "status", "kind" INTO invoice_status, invoice_kind FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  IF invoice_status <> 'DRAFT' THEN RAISE EXCEPTION 'Carry target must be a draft invoice'; END IF;
  delta := CASE WHEN NEW."type" = 'SHORTFALL_CARRY' THEN NEW."amount" ELSE -NEW."amount" END;
  PERFORM set_config('passionedu.recalculate_invoice_total', 'on', true);
  UPDATE "Invoice" SET "total" = "total" + delta WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NEW."type" = 'OVERPAYMENT_CARRY' AND invoice_kind <> 'SETTLEMENT' AND (SELECT "total" FROM "Invoice" WHERE "id" = NEW."invoiceId") < 0 THEN RAISE EXCEPTION 'Carry cannot make invoice total negative'; END IF;
  RETURN NEW;
END;
$$;
