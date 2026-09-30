-- Decision 2026-09-30 D10-D11: Finance reports show VAT and a coverage refund returns the refunded VAT.

-- VAT part of a VAT-inclusive refund amount: amount - round_half_up(amount * 100 / (100 + rate)).
CREATE FUNCTION coverage_refund_vat(amount bigint, rate integer) RETURNS bigint AS $$
  SELECT CASE WHEN rate IS NULL OR rate = 0 THEN 0::bigint
    ELSE amount - floor((amount::numeric * 200 + (100 + rate)) / (2 * (100 + rate)))::bigint END;
$$ LANGUAGE sql IMMUTABLE;

-- Issued coverage ------------------------------------------------------------------------------
ALTER TABLE "StudentPromotionalCoverage" ADD COLUMN "vatRateSnapshot" integer, ADD COLUMN "vatAmount" bigint NOT NULL DEFAULT 0;
ALTER TABLE "StudentPromotionalCoverage" ADD CONSTRAINT "StudentPromotionalCoverage_vat_snapshot" CHECK (
  ("vatRateSnapshot" IS NULL OR "vatRateSnapshot" IN (0, 5, 8, 10))
  AND "vatAmount" = COALESCE(floor((("originalPrice" - "reduction")::numeric * "vatRateSnapshot" + 50) / 100), 0)
);

CREATE OR REPLACE FUNCTION reject_student_promotional_coverage_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Promotion coverage is append-only'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "InvoicePromotionCoverageFact" fact
    JOIN "Invoice" invoice ON invoice."id" = fact."invoiceId" AND invoice."schoolId" = fact."schoolId"
    JOIN "Receipt" receipt ON receipt."id" = NEW."sourceReceiptId" AND receipt."schoolId" = NEW."schoolId"
    JOIN "Receivable" receivable ON receivable."id" = NEW."receivableId" AND receivable."schoolId" = NEW."schoolId"
    WHERE fact."id" = NEW."sourceFactId" AND fact."schoolId" = NEW."schoolId" AND fact."studentId" = NEW."studentId" AND fact."schoolYearId" = NEW."schoolYearId" AND fact."receivableId" = NEW."receivableId" AND fact."billingMonth" = NEW."billingMonth" AND fact."invoiceId" = NEW."sourceInvoiceId" AND fact."policyId" = NEW."policyId" AND fact."versionId" = NEW."versionId" AND fact."originalPrice" = NEW."originalPrice" AND fact."reduction" = NEW."reduction" AND fact."serviceStart" = NEW."serviceStart" AND fact."serviceEnd" = NEW."serviceEnd" AND fact."calendarEffectiveFrom" = NEW."calendarEffectiveFrom" AND fact."timezone" = NEW."timezone" AND invoice."status" = 'CLOSED' AND receipt."invoiceId" = invoice."id" AND receipt."outcome" = 'EXACT'
      -- The VAT rate is the one billed on the source Invoice line of the receivable, else the receivable's category.
      AND NEW."vatRateSnapshot" IS NOT DISTINCT FROM COALESCE(
        (SELECT line."vatRateSnapshot" FROM "InvoiceLine" line WHERE line."schoolId" = NEW."schoolId" AND line."invoiceId" = NEW."sourceInvoiceId" AND line."receivableId" = NEW."receivableId" AND line."kind" = 'NORMAL' ORDER BY line."id" LIMIT 1),
        CASE WHEN EXISTS (SELECT 1 FROM "InvoiceLine" line WHERE line."schoolId" = NEW."schoolId" AND line."invoiceId" = NEW."sourceInvoiceId" AND line."receivableId" = NEW."receivableId" AND line."kind" = 'NORMAL') THEN NULL ELSE receivable_tax_rate(receivable."taxCategory") END)
  ) THEN RAISE EXCEPTION 'Coverage requires an exact closed same-scope paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Coverage refunds ------------------------------------------------------------------------------
ALTER TABLE "CoverageReversalRequest" ADD COLUMN "vatAmount" bigint NOT NULL DEFAULT 0;
ALTER TABLE "CoverageReversal" ADD COLUMN "vatAmount" bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_request_graph() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; source_invoice "Invoice"; source_receipt "Receipt";
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_receipt FROM "Receipt" WHERE "id" = coverage."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF NEW."amount" <= 0 OR NEW."calculatedAmount" < 0 OR source_receipt."invoiceId" <> source_invoice."id" OR source_receipt."outcome" <> 'EXACT' OR source_invoice."status" NOT IN ('CLOSED', 'CANCELLED') OR source_invoice."reversalModeSnapshot" <> NEW."policyMode" THEN RAISE EXCEPTION 'Coverage reversal request requires a positive exact paid source snapshot'; END IF;
  IF NEW."vatAmount" <> coverage_refund_vat(NEW."amount", coverage."vatRateSnapshot") THEN RAISE EXCEPTION 'Coverage reversal request VAT must match the coverage VAT rate'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD."status" <> 'PENDING' OR NEW."coverageId" <> OLD."coverageId" OR NEW."amount" <> OLD."amount" OR NEW."vatAmount" <> OLD."vatAmount" OR NEW."calculatedAmount" <> OLD."calculatedAmount" OR NEW."overrideReason" IS DISTINCT FROM OLD."overrideReason" OR NEW."effectiveOn" <> OLD."effectiveOn" OR NEW."reason" <> OLD."reason" OR NEW."policyMode" <> OLD."policyMode" OR NEW."requestedByMembershipId" <> OLD."requestedByMembershipId" OR NEW."status" NOT IN ('REFUSED', 'POSTED') OR NEW."decidedByMembershipId" IS NULL OR NEW."decidedByMembershipId" = OLD."requestedByMembershipId") THEN RAISE EXCEPTION 'Coverage reversal request lifecycle is immutable and requires a distinct decider'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_graph() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; request "CoverageReversalRequest";
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  IF NEW."requestId" IS NOT NULL THEN
    SELECT * INTO request FROM "CoverageReversalRequest" WHERE "id" = NEW."requestId" AND "schoolId" = NEW."schoolId";
    IF request."status" <> 'PENDING' OR request."coverageId" <> NEW."coverageId" OR request."amount" <> NEW."amount" OR request."vatAmount" <> NEW."vatAmount"
      OR request."effectiveOn" <> NEW."effectiveOn" OR request."reason" <> NEW."reason" THEN RAISE EXCEPTION 'Coverage reversal must post exactly its pending request'; END IF;
  END IF;
  IF NEW."vatAmount" <> coverage_refund_vat(NEW."amount", coverage."vatRateSnapshot") THEN RAISE EXCEPTION 'Coverage reversal VAT must match the coverage VAT rate'; END IF;
  IF NEW."amount" > coverage."originalPrice" - coverage."reduction" + coverage."vatAmount" THEN RAISE EXCEPTION 'Coverage reversal exceeds paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_limits() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; invoice "Invoice"; receipt "Receipt"; total_reversed bigint;
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  SELECT * INTO invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO receipt FROM "Receipt" WHERE "id" = coverage."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF NEW."amount" <= 0 OR NEW."calculatedAmount" < 0 OR invoice."status" NOT IN ('CLOSED', 'CANCELLED') OR receipt."invoiceId" <> invoice."id" OR receipt."outcome" <> 'EXACT' THEN RAISE EXCEPTION 'Coverage reversal requires a positive exact paid source'; END IF;
  IF NEW."requestId" IS NULL AND invoice."reversalModeSnapshot" <> 'DIRECT' THEN RAISE EXCEPTION 'Coverage reversal requires School Admin approval'; END IF;
  SELECT COALESCE(sum("amount"), 0) INTO total_reversed FROM "CoverageReversal" WHERE "schoolId" = NEW."schoolId" AND "coverageId" = NEW."coverageId";
  IF total_reversed + NEW."amount" > coverage."originalPrice" - coverage."reduction" + coverage."vatAmount" THEN RAISE EXCEPTION 'Coverage reversal exceeds remaining paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Finance ledger ---------------------------------------------------------------------------------
ALTER TABLE "FinanceLedgerEvent" ADD COLUMN "vatAmount" bigint NOT NULL DEFAULT 0;

-- Backfill the VAT snapshot of existing events from the immutable Invoice lines.
SELECT set_config('passionedu.allow_history_cleanup', 'on', false);
UPDATE "FinanceLedgerEvent" event SET
  "vatAmount" = COALESCE((SELECT sum(line."vatAmount") FROM "InvoiceLine" line WHERE line."schoolId" = event."schoolId" AND line."invoiceId" = event."invoiceId"), 0),
  "provenance" = CASE WHEN jsonb_typeof(event."provenance" -> 'lines') = 'array' THEN jsonb_set(event."provenance", '{lines}', COALESCE((
    SELECT jsonb_agg(item.value || jsonb_build_object('vatRate', line."vatRateSnapshot", 'vatAmount', COALESCE(line."vatAmount", 0)::text) ORDER BY item.ordinality)
    FROM jsonb_array_elements(event."provenance" -> 'lines') WITH ORDINALITY AS item(value, ordinality)
    LEFT JOIN "InvoiceLine" line ON line."schoolId" = event."schoolId" AND line."id"::text = item.value ->> 'id'
  ), '[]'::jsonb)) ELSE event."provenance" END
WHERE event."invoiceId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "InvoiceLine" line WHERE line."schoolId" = event."schoolId" AND line."invoiceId" = event."invoiceId" AND line."vatAmount" <> 0);
SELECT set_config('passionedu.allow_history_cleanup', '', false);
