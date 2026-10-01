-- Decision 2026-10-01 D9: a Student whose enrollment ended last month gets a settlement Invoice per
-- channel in this month's run, holding only refunds (unused meals, unused prepaid package) and carries.
CREATE TYPE "InvoiceKind" AS ENUM ('NORMAL', 'SETTLEMENT');
ALTER TABLE "Invoice" ADD COLUMN "kind" "InvoiceKind" NOT NULL DEFAULT 'NORMAL';

CREATE OR REPLACE FUNCTION reject_invoice_kind_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."kind" IS DISTINCT FROM NEW."kind" THEN RAISE EXCEPTION 'Invoice kind is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_kind_immutable BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION reject_invoice_kind_change();

-- Decision 2026-10-01 D11: a prepaid package covers consecutive calendar months and may continue past
-- the end of its source SchoolYear; it must still start inside that SchoolYear.
CREATE OR REPLACE FUNCTION enforce_coverage_fact_period() RETURNS trigger LANGUAGE plpgsql AS $$
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
     OR (run_billing_month || '-01')::date >= year_row."endsOn"
     OR NEW."billingMonth" < run_billing_month
     OR version_row."effectiveFrom" > NEW."serviceStart"
     OR (version_row."effectiveTo" IS NOT NULL AND version_row."effectiveTo" <= NEW."serviceStart")
  THEN
    RAISE EXCEPTION 'Coverage fact must be a valid monthly fact starting in its SchoolYear';
  END IF;

  RETURN NEW;
END;
$$;
