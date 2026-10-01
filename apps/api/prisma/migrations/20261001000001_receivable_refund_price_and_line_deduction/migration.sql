-- Decision 2026-10-01: a receivable has a refund price per unit, and every NORMAL line has a
-- "Thu" part (unitPrice x quantity) and a "Bớt" part (refund price x deduction quantity).
ALTER TABLE "Receivable" ADD COLUMN "refundUnitPrice" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_refundUnitPrice_nonnegative" CHECK ("refundUnitPrice" >= 0);

-- The catalog stays append-only except the tax category and the refund price, which only affect lines written afterwards.
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;

ALTER TABLE "InvoiceLine"
  ADD COLUMN "refundUnitPriceSnapshot" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "deductionQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "proposedDeductionQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deductionAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "deductionReason" TEXT,
  ADD COLUMN "deductionSource" JSONB;

-- A settlement line may charge nothing ("Thu 0") and only deduct.
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_quantity_positive";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_quantities_valid" CHECK ("quantity" >= 0 AND "deductionQuantity" >= 0 AND "proposedDeductionQuantity" >= 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_deduction_valid" CHECK (
  "refundUnitPriceSnapshot" >= 0
  AND "deductionAmount" = "refundUnitPriceSnapshot" * "deductionQuantity"
  AND ("kind" = 'NORMAL' OR ("deductionQuantity" = 0 AND "deductionAmount" = 0 AND "proposedDeductionQuantity" = 0))
);

-- The promotion discount still applies to gross only; the deduction may take the line below zero.
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_calculated_amounts";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_calculated_amounts" CHECK (
  "grossAmount" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "grossAmount"
  AND "netAmount" = "grossAmount" - "discountAmount" - "deductionAmount"
  AND "amount" = "netAmount" + "vatAmount"
  AND (("netAmount" >= 0 AND "vatAmount" >= 0) OR ("netAmount" < 0 AND "vatAmount" <= 0))
);

-- VAT on a negative net is the negated VAT of its absolute value (half-up rounding stays symmetric).
ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_vat_snapshot";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_vat_snapshot" CHECK (
  ("kind" = 'PRIOR_DEBT' AND "taxCategorySnapshot" IS NULL AND "vatRateSnapshot" IS NULL AND "vatAmount" = 0)
  OR ("kind" = 'NORMAL' AND "taxCategorySnapshot" IS NOT NULL
    AND "vatRateSnapshot" IS NOT DISTINCT FROM receivable_tax_rate("taxCategorySnapshot")
    AND "vatAmount"::numeric = CASE
      WHEN "netAmount" < 0 THEN -COALESCE(floor((-"netAmount"::numeric * "vatRateSnapshot"::numeric + 50) / 100), 0)
      ELSE COALESCE(floor(("netAmount"::numeric * "vatRateSnapshot"::numeric + 50) / 100), 0)
    END)
);

-- Ledger issue events carry the deductions included in the obligation.
ALTER TABLE "FinanceLedgerEvent" ADD COLUMN "deductionAmount" BIGINT NOT NULL DEFAULT 0;
