-- AlterTable
ALTER TABLE "PromotionPolicyVersion" ADD COLUMN "prepaidTermMonths" INTEGER;

-- AlterTable
ALTER TABLE "InvoicePromotionCoverageFact" ALTER COLUMN "assignmentId" DROP NOT NULL;

-- Repair trigger functions for prepaid coverage draft mutation and term periods
CREATE OR REPLACE FUNCTION reject_invoice_coverage_fact_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Promotion coverage is append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Invoice" invoice
      WHERE invoice."id" = OLD."invoiceId"
        AND invoice."schoolId" = OLD."schoolId"
        AND invoice."status" = 'DRAFT'
    ) THEN
      RAISE EXCEPTION 'Promotion coverage is append-only';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "StudentPromotionalCoverage" spc
      WHERE spc."sourceFactId" = OLD."id"
        AND spc."schoolId" = OLD."schoolId"
    ) THEN
      RAISE EXCEPTION 'Promotion coverage is append-only';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Invoice" invoice
    JOIN "PromotionPolicyVersion" version ON version."id" = NEW."versionId" AND version."schoolId" = NEW."schoolId" AND version."policyId" = NEW."policyId" AND version."fulfillmentMode" = 'PREPAID_COVERAGE'
    JOIN "PromotionPolicyTarget" target ON target."id" = NEW."targetId" AND target."schoolId" = NEW."schoolId" AND target."versionId" = version."id" AND target."receivableId" = NEW."receivableId"
    WHERE invoice."id" = NEW."invoiceId" AND invoice."schoolId" = NEW."schoolId" AND invoice."status" = 'DRAFT'
      AND invoice."studentId" = NEW."studentId" AND invoice."schoolYearId" = NEW."schoolYearId"
  ) THEN
    RAISE EXCEPTION 'Coverage fact requires a same-scope draft Invoice snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_coverage_fact_period() RETURNS trigger AS $$
DECLARE
  year_row "SchoolYear";
  version_row "PromotionPolicyVersion";
  run_billing_month text;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;

  SELECT * INTO year_row FROM "SchoolYear" WHERE "id" = NEW."schoolYearId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO version_row FROM "PromotionPolicyVersion" WHERE "id" = NEW."versionId" AND "schoolId" = NEW."schoolId";
  SELECT cr."billingMonth" INTO run_billing_month
    FROM "Invoice" i
    JOIN "CollectionRun" cr ON cr."id" = i."collectionRunId" AND cr."schoolId" = i."schoolId"
    WHERE i."id" = NEW."invoiceId" AND i."schoolId" = NEW."schoolId";

  IF NOT FOUND
     OR NEW."billingMonth" !~ '^\d{4}-(0[1-9]|1[0-2])$'
     OR NEW."serviceStart" <> (NEW."billingMonth" || '-01')::date
     OR NEW."serviceEnd" <> (NEW."serviceStart" + INTERVAL '1 month')::date
     OR NEW."serviceStart" >= NEW."serviceEnd"
     OR NEW."serviceStart" < year_row."startsOn"
     OR NEW."serviceStart" >= year_row."endsOn"
     OR NEW."billingMonth" < run_billing_month
     OR version_row."effectiveFrom" > NEW."serviceStart"
     OR (version_row."effectiveTo" IS NOT NULL AND version_row."effectiveTo" <= NEW."serviceStart")
  THEN
    RAISE EXCEPTION 'Coverage fact must be a valid monthly same-SchoolYear source fact';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
