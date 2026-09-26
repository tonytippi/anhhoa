CREATE OR REPLACE FUNCTION reject_issued_promotion_application_mutation() RETURNS trigger AS $$
DECLARE
  application JSONB;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Issued promotion application is immutable'; END IF;
  SELECT evaluation.application INTO application
  FROM "Invoice" i
  JOIN "InvoiceLine" l ON l."schoolId" = i."schoolId" AND l."invoiceId" = i."id"
  CROSS JOIN LATERAL jsonb_array_elements(l."promotionEvaluationProvenance"->'applications') WITH ORDINALITY AS evaluation(application, ordinal)
  WHERE i."schoolId" = NEW."schoolId" AND i."id" = NEW."invoiceId" AND l."id" = NEW."invoiceLineId"
    AND i."status" = 'ISSUED' AND evaluation.ordinal = NEW."ordinal" + 1
    AND (l."grossAmount", l."discountAmount", l."netAmount") = (NEW."grossAmount", NEW."discountAmount", NEW."netAmount");
  IF application IS NULL
    OR application->>'policyId' IS DISTINCT FROM NEW."policyId"::text
    OR application->>'versionId' IS DISTINCT FROM NEW."versionId"::text
    OR application->>'targetId' IS DISTINCT FROM NEW."targetId"::text
    OR application->>'assignmentId' IS DISTINCT FROM NEW."assignmentId"::text
    OR application->>'discountType' IS DISTINCT FROM NEW."discountType"::text
    OR application->>'discountValue' IS DISTINCT FROM NEW."discountValue"::text
    OR application->>'priority' IS DISTINCT FROM NEW."priority"::text
    OR application->>'stackingMode' IS DISTINCT FROM NEW."stackingMode"::text
    OR application->>'appliedDiscount' IS DISTINCT FROM NEW."appliedDiscount"::text
    OR application->'versionInterval' IS DISTINCT FROM NEW."versionInterval"
    OR application->'assignmentInterval' IS DISTINCT FROM NEW."assignmentInterval"
    OR application->>'assignmentReason' IS DISTINCT FROM NEW."assignmentReason"
  THEN RAISE EXCEPTION 'Issued promotion application requires matching Draft same-School provenance and outcome'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
