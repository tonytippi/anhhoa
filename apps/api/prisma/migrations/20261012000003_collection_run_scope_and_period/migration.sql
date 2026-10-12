-- Sprint change 2026-10-12: a CollectionRun is a scope (whole School or one Class) plus an inclusive service period.
-- billingMonth stays as the month of periodStartsOn for filters, reports and month-based coverage; it no longer orders runs.
CREATE TYPE "CollectionRunScope" AS ENUM ('SCHOOL', 'CLASS');

ALTER TABLE "CollectionRun"
  ADD COLUMN "scope" "CollectionRunScope" NOT NULL DEFAULT 'SCHOOL',
  ADD COLUMN "classId" UUID,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "periodStartsOn" DATE,
  ADD COLUMN "periodEndsOn" DATE;

ALTER TABLE "CollectionRun" DISABLE TRIGGER USER;
UPDATE "CollectionRun" SET
  "name" = 'Tháng ' || substr("billingMonth", 6, 2) || '/' || substr("billingMonth", 1, 4),
  "periodStartsOn" = ("billingMonth" || '-01')::date,
  "periodEndsOn" = (("billingMonth" || '-01')::date + interval '1 month' - interval '1 day')::date;
ALTER TABLE "CollectionRun" ENABLE TRIGGER USER;

ALTER TABLE "CollectionRun"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "periodStartsOn" SET NOT NULL,
  ALTER COLUMN "periodEndsOn" SET NOT NULL,
  DROP COLUMN "type",
  DROP CONSTRAINT "CollectionRun_month_unique",
  ADD CONSTRAINT "CollectionRun_class_graph_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "classId") REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "CollectionRun_scope_target" CHECK (("scope" = 'SCHOOL' AND "classId" IS NULL) OR ("scope" = 'CLASS' AND "classId" IS NOT NULL)),
  ADD CONSTRAINT "CollectionRun_name_present" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "CollectionRun_period_order" CHECK ("periodStartsOn" <= "periodEndsOn"),
  ADD CONSTRAINT "CollectionRun_month_from_period" CHECK ("billingMonth" = to_char("periodStartsOn", 'YYYY-MM')),
  ADD CONSTRAINT "CollectionRun_school_period_is_month" CHECK ("scope" <> 'SCHOOL' OR ("periodStartsOn" = date_trunc('month', "periodStartsOn")::date AND "periodEndsOn" = (date_trunc('month', "periodStartsOn") + interval '1 month' - interval '1 day')::date)),
  -- Two runs of one Class never overlap.
  ADD CONSTRAINT "CollectionRun_class_period_no_overlap" EXCLUDE USING gist ("schoolId" WITH =, "classId" WITH =, daterange("periodStartsOn", "periodEndsOn", '[]') WITH &&) WHERE ("scope" = 'CLASS');
DROP TYPE "CollectionRunType";

-- One SCHOOL-scope run per month of a SchoolYear; CLASS runs share months freely.
CREATE UNIQUE INDEX "CollectionRun_school_month_unique" ON "CollectionRun"("schoolId", "schoolYearId", "billingMonth") WHERE "scope" = 'SCHOOL';
CREATE INDEX "CollectionRun_schoolId_classId_periodStartsOn_idx" ON "CollectionRun"("schoolId", "classId", "periodStartsOn");

-- The carry of a settlement difference targets the Student's next DRAFT by run period, whatever the scope.
CREATE OR REPLACE FUNCTION reject_settlement_carry_mutation() RETURNS trigger AS $$

DECLARE difference_row "SettlementDifference"; target_invoice "Invoice"; source_invoice "Invoice"; source_period date; next_eligible_invoice_id uuid; applied bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement carry is immutable'; END IF;
  SELECT * INTO difference_row FROM "SettlementDifference" WHERE "id" = NEW."settlementDifferenceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  SELECT * INTO target_invoice FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = difference_row."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT "periodStartsOn" INTO source_period FROM "CollectionRun" WHERE "schoolId" = NEW."schoolId" AND "id" = source_invoice."collectionRunId";
  SELECT candidate."id" INTO next_eligible_invoice_id
  FROM "Invoice" candidate JOIN "CollectionRun" candidate_run ON candidate_run."schoolId" = candidate."schoolId" AND candidate_run."id" = candidate."collectionRunId"
  WHERE candidate."schoolId" = NEW."schoolId" AND candidate."studentId" = NEW."studentId" AND candidate."schoolYearId" = NEW."schoolYearId"
    AND candidate."channel" = source_invoice."channel" AND candidate."status" = 'DRAFT' AND candidate_run."periodStartsOn" > source_period
  ORDER BY candidate_run."periodStartsOn" ASC, candidate_run."id" ASC LIMIT 1;
  IF NOT FOUND OR difference_row."studentId" <> NEW."studentId" OR difference_row."schoolYearId" <> NEW."schoolYearId" OR target_invoice."studentId" <> NEW."studentId" OR target_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."status" <> 'DRAFT' OR target_invoice."id" <> next_eligible_invoice_id OR NEW."type" <> (CASE WHEN difference_row."signedAmount" > 0 THEN 'SHORTFALL_CARRY'::"SettlementCarryType" ELSE 'OVERPAYMENT_CARRY'::"SettlementCarryType" END) THEN RAISE EXCEPTION 'Settlement carry must target the next eligible same-Student same-SchoolYear draft by run period'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "SettlementCarry" WHERE "schoolId" = NEW."schoolId" AND "settlementDifferenceId" = NEW."settlementDifferenceId";
  IF NEW."amount" > abs(difference_row."signedAmount") - applied THEN RAISE EXCEPTION 'Settlement carry exceeds source remainder'; END IF;
  RETURN NEW;
END;

$$ LANGUAGE plpgsql;
