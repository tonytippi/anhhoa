-- A PL/pgSQL trigger function is compiled against each table row type. Keep the
-- fact and issued-coverage guards separate so fact inserts never reference receipt columns.
CREATE OR REPLACE FUNCTION reject_invoice_coverage_fact_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Promotion coverage is append-only'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Invoice" invoice
    JOIN "PromotionPolicyVersion" version ON version."id" = NEW."versionId" AND version."schoolId" = NEW."schoolId" AND version."policyId" = NEW."policyId" AND version."fulfillmentMode" = 'PREPAID_COVERAGE'
    JOIN "PromotionPolicyTarget" target ON target."id" = NEW."targetId" AND target."schoolId" = NEW."schoolId" AND target."versionId" = version."id" AND target."receivableId" = NEW."receivableId"
    JOIN "StudentPromotionAssignment" assignment ON assignment."id" = NEW."assignmentId" AND assignment."schoolId" = NEW."schoolId" AND assignment."versionId" = version."id" AND assignment."policyId" = version."policyId" AND assignment."studentId" = NEW."studentId"
    WHERE invoice."id" = NEW."invoiceId" AND invoice."schoolId" = NEW."schoolId" AND invoice."status" = 'DRAFT'
      AND invoice."studentId" = NEW."studentId" AND invoice."schoolYearId" = NEW."schoolYearId"
      AND assignment."effectiveFrom" <= NEW."serviceStart" AND (assignment."effectiveTo" IS NULL OR assignment."effectiveTo" > NEW."serviceStart")
  ) THEN RAISE EXCEPTION 'Coverage fact requires a same-scope draft Invoice snapshot'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_student_promotional_coverage_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Promotion coverage is append-only'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "InvoicePromotionCoverageFact" fact
    JOIN "Invoice" invoice ON invoice."id" = fact."invoiceId" AND invoice."schoolId" = fact."schoolId"
    JOIN "Receipt" receipt ON receipt."id" = NEW."sourceReceiptId" AND receipt."schoolId" = NEW."schoolId"
    WHERE fact."id" = NEW."sourceFactId" AND fact."schoolId" = NEW."schoolId" AND fact."studentId" = NEW."studentId" AND fact."schoolYearId" = NEW."schoolYearId" AND fact."receivableId" = NEW."receivableId" AND fact."billingMonth" = NEW."billingMonth" AND fact."invoiceId" = NEW."sourceInvoiceId" AND fact."policyId" = NEW."policyId" AND fact."versionId" = NEW."versionId" AND fact."originalPrice" = NEW."originalPrice" AND fact."reduction" = NEW."reduction" AND fact."serviceStart" = NEW."serviceStart" AND fact."serviceEnd" = NEW."serviceEnd" AND fact."calendarEffectiveFrom" = NEW."calendarEffectiveFrom" AND fact."timezone" = NEW."timezone" AND invoice."status" = 'CLOSED' AND receipt."invoiceId" = invoice."id" AND receipt."outcome" = 'EXACT'
  ) THEN RAISE EXCEPTION 'Coverage requires an exact closed same-scope paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_coverage_fact_immutable ON "InvoicePromotionCoverageFact";
DROP TRIGGER IF EXISTS student_promotional_coverage_immutable ON "StudentPromotionalCoverage";
CREATE TRIGGER invoice_coverage_fact_immutable BEFORE INSERT OR UPDATE OR DELETE ON "InvoicePromotionCoverageFact" FOR EACH ROW EXECUTE FUNCTION reject_invoice_coverage_fact_mutation();
CREATE TRIGGER student_promotional_coverage_immutable BEFORE INSERT OR UPDATE OR DELETE ON "StudentPromotionalCoverage" FOR EACH ROW EXECUTE FUNCTION reject_student_promotional_coverage_mutation();
