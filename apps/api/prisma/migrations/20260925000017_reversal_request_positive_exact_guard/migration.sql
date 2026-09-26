CREATE OR REPLACE FUNCTION enforce_coverage_reversal_request_graph() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; source_invoice "Invoice"; source_receipt "Receipt";
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_receipt FROM "Receipt" WHERE "id" = coverage."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF NEW."amount" <= 0 OR NEW."calculatedAmount" < 0 OR source_receipt."invoiceId" <> source_invoice."id" OR source_receipt."outcome" <> 'EXACT' OR source_invoice."status" NOT IN ('CLOSED', 'CANCELLED') OR source_invoice."reversalModeSnapshot" <> NEW."policyMode" THEN RAISE EXCEPTION 'Coverage reversal request requires a positive exact paid source snapshot'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD."status" <> 'PENDING' OR NEW."coverageId" <> OLD."coverageId" OR NEW."amount" <> OLD."amount" OR NEW."calculatedAmount" <> OLD."calculatedAmount" OR NEW."overrideReason" IS DISTINCT FROM OLD."overrideReason" OR NEW."effectiveOn" <> OLD."effectiveOn" OR NEW."reason" <> OLD."reason" OR NEW."policyMode" <> OLD."policyMode" OR NEW."requestedByMembershipId" <> OLD."requestedByMembershipId" OR NEW."status" NOT IN ('REFUSED', 'POSTED') OR NEW."decidedByMembershipId" IS NULL OR NEW."decidedByMembershipId" = OLD."requestedByMembershipId") THEN RAISE EXCEPTION 'Coverage reversal request lifecycle is immutable and requires a distinct decider'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
