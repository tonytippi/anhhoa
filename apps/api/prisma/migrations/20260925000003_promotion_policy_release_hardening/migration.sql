ALTER TABLE "IssuedPromotionApplication"
  ADD COLUMN "grossAmount" BIGINT,
  ADD COLUMN "discountAmount" BIGINT,
  ADD COLUMN "netAmount" BIGINT;

-- This migration backfills columns added after the immutable trigger exists.
-- Scope the trigger bypass to this transaction-local historical repair only.
SELECT set_config('passionedu.allow_history_cleanup', 'on', false);

UPDATE "IssuedPromotionApplication" application
SET
  "grossAmount" = line."grossAmount",
  "discountAmount" = line."discountAmount",
  "netAmount" = line."netAmount"
FROM "InvoiceLine" line
WHERE line."schoolId" = application."schoolId" AND line."id" = application."invoiceLineId";

SELECT set_config('passionedu.allow_history_cleanup', 'off', false);

ALTER TABLE "IssuedPromotionApplication"
  ALTER COLUMN "grossAmount" SET NOT NULL,
  ALTER COLUMN "discountAmount" SET NOT NULL,
  ALTER COLUMN "netAmount" SET NOT NULL,
  ADD CONSTRAINT "IssuedPromotionApplication_amounts_valid" CHECK (
    "grossAmount" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "grossAmount"
    AND "netAmount" = "grossAmount" - "discountAmount" AND "appliedDiscount" <= "discountAmount"
  );

ALTER TABLE "PromotionPolicyVersion"
  ADD CONSTRAINT "PromotionPolicyVersion_schoolId_id_policyId_key" UNIQUE ("schoolId", "id", "policyId");

ALTER TABLE "StudentPromotionAssignment"
  ADD CONSTRAINT "StudentPromotionAssignment_version_policy_graph_fkey"
  FOREIGN KEY ("schoolId", "versionId", "policyId")
  REFERENCES "PromotionPolicyVersion"("schoolId", "id", "policyId") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION reject_issued_promotion_application_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Issued promotion application is immutable'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "Invoice" i
    JOIN "InvoiceLine" l ON l."schoolId" = i."schoolId" AND l."invoiceId" = i."id"
    JOIN "PromotionPolicyVersion" v ON v."schoolId" = NEW."schoolId" AND v."id" = NEW."versionId" AND v."policyId" = NEW."policyId"
    JOIN "PromotionPolicyTarget" t ON t."schoolId" = NEW."schoolId" AND t."id" = NEW."targetId" AND t."versionId" = v."id" AND t."receivableId" = l."receivableId"
    JOIN "StudentPromotionAssignment" a ON a."schoolId" = NEW."schoolId" AND a."id" = NEW."assignmentId" AND a."studentId" = i."studentId" AND a."policyId" = NEW."policyId" AND a."versionId" = NEW."versionId"
    WHERE i."schoolId" = NEW."schoolId" AND i."id" = NEW."invoiceId" AND l."id" = NEW."invoiceLineId"
      AND i."status" = 'DRAFT'
      AND (l."grossAmount", l."discountAmount", l."netAmount") = (NEW."grossAmount", NEW."discountAmount", NEW."netAmount")
  ) THEN RAISE EXCEPTION 'Issued promotion application requires matching Draft same-School provenance and outcome'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
