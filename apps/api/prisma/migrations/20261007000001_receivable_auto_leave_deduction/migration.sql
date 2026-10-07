-- Decision 2026-10-07 (receivable-auto-leave-deduction): units stay free text and quantities stay Finance's call. A Receivable proposes
-- "Bớt" from last month's approved leave days only when Finance turns on autoLeaveDeduction; Bớt can still be typed by hand on any line.
ALTER TABLE "Receivable" ADD COLUMN "autoLeaveDeduction" BOOLEAN NOT NULL DEFAULT false;

-- Receivables that refunded leave days before keep doing so.
DO $$
BEGIN
  PERFORM set_config('passionedu.allow_history_cleanup', 'on', true);
  UPDATE "Receivable" SET "autoLeaveDeduction" = true WHERE "refundUnitPrice" > 0;
END;
$$;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_autoLeaveDeduction_needs_refund_price" CHECK (NOT "autoLeaveDeduction" OR "refundUnitPrice" > 0);

-- Same as 20261002000003_extracurricular_classes, plus autoLeaveDeduction among the editable columns.
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice' - 'autoLeaveDeduction' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice' - 'autoLeaveDeduction' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') THEN
    IF NEW."groupId" <> OLD."groupId" AND (
      EXISTS (SELECT 1 FROM "InvoiceLine" l WHERE l."schoolId" = OLD."schoolId" AND l."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "CollectionRunTemplateLine" t WHERE t."schoolId" = OLD."schoolId" AND t."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "ExtracurricularClass" c WHERE c."schoolId" = OLD."schoolId" AND c."receivableId" = OLD."id")
    ) THEN
      RAISE EXCEPTION 'Receivable kind cannot change once the Receivable is used on an Invoice, collection template or extracurricular class';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;

-- A prepaid package may carry no discount: the Parent pays N months up front at list price and the months are still tracked.
ALTER TABLE "PromotionPolicyVersion" DROP CONSTRAINT "PromotionPolicyVersion_discount";
ALTER TABLE "PromotionPolicyVersion" ADD CONSTRAINT "PromotionPolicyVersion_discount" CHECK (
  ("discountValue" > 0 OR ("discountValue" = 0 AND "fulfillmentMode" = 'PREPAID_COVERAGE'))
  AND ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100)
);
