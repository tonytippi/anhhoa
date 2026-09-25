ALTER TABLE "InvoiceLine"
  ADD COLUMN "grossAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "promotionEvaluationProvenance" JSONB;

SET passionedu.allow_history_cleanup = 'on';
UPDATE "InvoiceLine"
SET "grossAmount" = "amount", "netAmount" = "amount";
RESET passionedu.allow_history_cleanup;

ALTER TABLE "InvoiceLine"
  DROP CONSTRAINT "InvoiceLine_amount_matches",
  ADD CONSTRAINT "InvoiceLine_gross_amount_matches" CHECK ("grossAmount" = "unitPrice" * "quantity"),
  ADD CONSTRAINT "InvoiceLine_calculated_amounts" CHECK (
    "grossAmount" >= 0
    AND "discountAmount" >= 0
    AND "discountAmount" <= "grossAmount"
    AND "netAmount" = "grossAmount" - "discountAmount"
    AND "amount" = "netAmount"
  );

CREATE OR REPLACE FUNCTION enforce_collection_run_close_finality() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND (OLD."schoolId", OLD."schoolYearId", OLD."type", OLD."billingMonth", OLD."status", OLD."version", OLD."createdAt") IS DISTINCT FROM (NEW."schoolId", NEW."schoolYearId", NEW."type", NEW."billingMonth", NEW."status", NEW."version", NEW."createdAt") THEN RAISE EXCEPTION 'CLOSED CollectionRun business data is immutable'; END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" <> 'GENERATED' THEN RAISE EXCEPTION 'CollectionRun can transition to CLOSED only from GENERATED'; END IF;
  IF NEW."status" = 'CLOSED' AND EXISTS (SELECT 1 FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" NOT IN ('ISSUED', 'CANCELLED') AND NOT ("status" = 'DRAFT' AND "total" = 0)) THEN RAISE EXCEPTION 'Cannot close CollectionRun with non-terminal invoices'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
