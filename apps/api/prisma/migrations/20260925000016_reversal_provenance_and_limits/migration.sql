ALTER TABLE "CoverageReversalRequest" ADD COLUMN "calculatedAmount" bigint NOT NULL DEFAULT 0, ADD COLUMN "overrideReason" text;
ALTER TABLE "CoverageReversal" ADD COLUMN "calculatedAmount" bigint NOT NULL DEFAULT 0, ADD COLUMN "overrideReason" text;
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_schoolId_sourceInvoiceId_key" UNIQUE ("schoolId", "sourceInvoiceId");

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_request_finality() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Coverage reversal request provenance is append-only'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_reversal_request_no_delete BEFORE DELETE ON "CoverageReversalRequest" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_request_finality();

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_limits() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; invoice "Invoice"; receipt "Receipt"; total_reversed bigint;
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO receipt FROM "Receipt" WHERE "id" = coverage."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF NEW."amount" <= 0 OR NEW."calculatedAmount" < 0 OR invoice."status" NOT IN ('CLOSED', 'CANCELLED') OR receipt."invoiceId" <> invoice."id" OR receipt."outcome" <> 'EXACT' THEN RAISE EXCEPTION 'Coverage reversal requires a positive exact paid source'; END IF;
  IF NEW."requestId" IS NULL AND invoice."reversalModeSnapshot" <> 'DIRECT' THEN RAISE EXCEPTION 'Coverage reversal requires School Admin approval'; END IF;
  SELECT COALESCE(sum("amount"), 0) INTO total_reversed FROM "CoverageReversal" WHERE "schoolId" = NEW."schoolId" AND "coverageId" = NEW."coverageId";
  IF total_reversed + NEW."amount" > coverage."originalPrice" - coverage."reduction" THEN RAISE EXCEPTION 'Coverage reversal exceeds remaining paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_reversal_limits_guard BEFORE INSERT ON "CoverageReversal" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_limits();
