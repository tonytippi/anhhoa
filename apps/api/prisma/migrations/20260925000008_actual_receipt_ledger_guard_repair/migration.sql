CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger AS $$
DECLARE invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt is immutable'; END IF;
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NOT FOUND OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Receipt must close one issued same-Student same-SchoolYear invoice'; END IF;
  IF NEW."outcome" <> (CASE WHEN NEW."actualAmount" = invoice_row."obligationTotalSnapshot" THEN 'EXACT'::"SettlementOutcome" WHEN NEW."actualAmount" < invoice_row."obligationTotalSnapshot" THEN 'SHORTFALL'::"SettlementOutcome" ELSE 'OVERPAYMENT'::"SettlementOutcome" END) THEN RAISE EXCEPTION 'Receipt outcome must be derived from invoice amount'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS receipt_immutable_and_linked ON "Receipt";
CREATE TRIGGER receipt_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "Receipt" FOR EACH ROW EXECUTE FUNCTION reject_receipt_mutation();

CREATE OR REPLACE FUNCTION reject_settlement_difference_mutation() RETURNS trigger AS $$
DECLARE receipt_row "Receipt"; invoice_row "Invoice";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement difference is immutable'; END IF;
  SELECT * INTO receipt_row FROM "Receipt" WHERE "id" = NEW."receiptId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO invoice_row FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  IF NOT FOUND OR receipt_row."invoiceId" <> NEW."invoiceId" OR receipt_row."studentId" <> NEW."studentId" OR receipt_row."schoolYearId" <> NEW."schoolYearId" OR invoice_row."studentId" <> NEW."studentId" OR invoice_row."schoolYearId" <> NEW."schoolYearId" OR NEW."signedAmount" <> receipt_row."actualAmount" - invoice_row."obligationTotalSnapshot" THEN RAISE EXCEPTION 'Settlement difference must be the non-zero receipt delta for its invoice'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS settlement_difference_immutable_and_linked ON "SettlementDifference";
CREATE TRIGGER settlement_difference_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "SettlementDifference" FOR EACH ROW EXECUTE FUNCTION reject_settlement_difference_mutation();

CREATE OR REPLACE FUNCTION reject_settlement_carry_mutation() RETURNS trigger AS $$
DECLARE difference_row "SettlementDifference"; target_invoice "Invoice"; source_invoice "Invoice"; next_eligible_invoice_id uuid; applied bigint;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement carry is immutable'; END IF;
  -- Lock each source row before calculating the remainder so direct concurrent
  -- inserts serialize just as the service's source-lock order does.
  SELECT * INTO difference_row FROM "SettlementDifference" WHERE "id" = NEW."settlementDifferenceId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  SELECT * INTO target_invoice FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = difference_row."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT candidate."id" INTO next_eligible_invoice_id
  FROM "Invoice" candidate JOIN "CollectionRun" candidate_run ON candidate_run."schoolId" = candidate."schoolId" AND candidate_run."id" = candidate."collectionRunId"
  WHERE candidate."schoolId" = NEW."schoolId" AND candidate."studentId" = NEW."studentId" AND candidate."schoolYearId" = NEW."schoolYearId"
    AND candidate."status" = 'DRAFT' AND candidate_run."type" = 'MONTHLY' AND candidate."billingMonth" > source_invoice."billingMonth"
  ORDER BY candidate."billingMonth" ASC LIMIT 1;
  IF NOT FOUND OR difference_row."studentId" <> NEW."studentId" OR difference_row."schoolYearId" <> NEW."schoolYearId" OR target_invoice."studentId" <> NEW."studentId" OR target_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."status" <> 'DRAFT' OR target_invoice."id" <> next_eligible_invoice_id OR NEW."type" <> (CASE WHEN difference_row."signedAmount" < 0 THEN 'SHORTFALL_CARRY'::"SettlementCarryType" ELSE 'OVERPAYMENT_CARRY'::"SettlementCarryType" END) THEN RAISE EXCEPTION 'Settlement carry must target the next eligible monthly same-Student same-SchoolYear draft'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "SettlementCarry" WHERE "schoolId" = NEW."schoolId" AND "settlementDifferenceId" = NEW."settlementDifferenceId";
  IF NEW."amount" > abs(difference_row."signedAmount") - applied THEN RAISE EXCEPTION 'Settlement carry exceeds source remainder'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS settlement_carry_immutable_and_linked ON "SettlementCarry";
CREATE TRIGGER settlement_carry_immutable_and_linked BEFORE INSERT OR UPDATE OR DELETE ON "SettlementCarry" FOR EACH ROW EXECUTE FUNCTION reject_settlement_carry_mutation();
