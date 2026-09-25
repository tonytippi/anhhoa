ALTER TABLE "InvoiceLine"
  ADD COLUMN "grossAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "promotionEvaluationProvenance" JSONB;

SELECT set_config('passionedu.allow_history_cleanup', 'on', true);
UPDATE "InvoiceLine"
SET "grossAmount" = "amount", "netAmount" = "amount";

ALTER TABLE "InvoiceLine"
  ADD CONSTRAINT "InvoiceLine_calculated_amounts" CHECK (
    "grossAmount" >= 0
    AND "discountAmount" >= 0
    AND "discountAmount" <= "grossAmount"
    AND "netAmount" = "grossAmount" - "discountAmount"
    AND "amount" = "netAmount"
  );
