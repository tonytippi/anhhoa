CREATE OR REPLACE FUNCTION reject_settlement_carry_mutation() RETURNS trigger AS $$
DECLARE difference_row "SettlementDifference"; target_invoice "Invoice"; source_invoice "Invoice"; next_eligible_invoice_id uuid; applied bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement carry is immutable'; END IF;
  SELECT * INTO difference_row FROM "SettlementDifference" WHERE "id" = NEW."settlementDifferenceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  SELECT * INTO target_invoice FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = difference_row."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT candidate."id" INTO next_eligible_invoice_id
  FROM "Invoice" candidate JOIN "CollectionRun" candidate_run ON candidate_run."schoolId" = candidate."schoolId" AND candidate_run."id" = candidate."collectionRunId"
  WHERE candidate."schoolId" = NEW."schoolId" AND candidate."studentId" = NEW."studentId" AND candidate."schoolYearId" = NEW."schoolYearId"
    AND candidate."status" = 'DRAFT' AND candidate_run."type" = 'MONTHLY' AND candidate."billingMonth" > source_invoice."billingMonth"
  ORDER BY candidate."billingMonth" ASC LIMIT 1;
  IF NOT FOUND OR difference_row."studentId" <> NEW."studentId" OR difference_row."schoolYearId" <> NEW."schoolYearId" OR target_invoice."studentId" <> NEW."studentId" OR target_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."status" <> 'DRAFT' OR target_invoice."id" <> next_eligible_invoice_id OR NEW."type" <> (CASE WHEN difference_row."signedAmount" > 0 THEN 'SHORTFALL_CARRY'::"SettlementCarryType" ELSE 'OVERPAYMENT_CARRY'::"SettlementCarryType" END) THEN RAISE EXCEPTION 'Settlement carry must target the next eligible monthly same-Student same-SchoolYear draft'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "SettlementCarry" WHERE "schoolId" = NEW."schoolId" AND "settlementDifferenceId" = NEW."settlementDifferenceId";
  IF NEW."amount" > abs(difference_row."signedAmount") - applied THEN RAISE EXCEPTION 'Settlement carry exceeds source remainder'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
