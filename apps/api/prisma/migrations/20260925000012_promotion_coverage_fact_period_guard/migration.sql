CREATE OR REPLACE FUNCTION enforce_coverage_fact_period() RETURNS trigger AS $$
DECLARE year_row "SchoolYear"; version_row "PromotionPolicyVersion"; source_line "InvoiceLine";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  SELECT * INTO year_row FROM "SchoolYear" WHERE "id" = NEW."schoolYearId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO version_row FROM "PromotionPolicyVersion" WHERE "id" = NEW."versionId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_line FROM "InvoiceLine" WHERE "invoiceId" = NEW."invoiceId" AND "schoolId" = NEW."schoolId" AND "receivableId" = NEW."receivableId";
  IF NOT FOUND OR NEW."billingMonth" !~ '^\d{4}-(0[1-9]|1[0-2])$' OR NEW."serviceStart" <> (NEW."billingMonth" || '-01')::date OR NEW."serviceEnd" <> (NEW."serviceStart" + INTERVAL '1 month')::date OR NEW."serviceStart" >= NEW."serviceEnd" OR NEW."serviceStart" < year_row."startsOn" OR NEW."serviceStart" >= year_row."endsOn" OR NEW."serviceStart" <= (SELECT "rosterAsOf" FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId") OR version_row."effectiveFrom" > NEW."serviceStart" OR (version_row."effectiveTo" IS NOT NULL AND version_row."effectiveTo" <= NEW."serviceStart") OR source_line."schoolId" IS NULL THEN
    RAISE EXCEPTION 'Coverage fact must be a future valid monthly same-SchoolYear source fact';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS coverage_fact_period_guard ON "InvoicePromotionCoverageFact";
CREATE TRIGGER coverage_fact_period_guard BEFORE INSERT ON "InvoicePromotionCoverageFact" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_fact_period();
