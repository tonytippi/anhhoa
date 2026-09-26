CREATE OR REPLACE FUNCTION reject_settlement_difference_mutation() RETURNS trigger AS $$
DECLARE invoice "Invoice"; receipt "Receipt"; transferred bigint;
BEGIN
  SELECT * INTO invoice FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO receipt FROM "Receipt" WHERE "id" = NEW."receiptId" AND "schoolId" = NEW."schoolId";
  SELECT COALESCE(sum("amount"), 0) INTO transferred FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."invoiceId";
  IF invoice IS NULL OR receipt IS NULL OR receipt."invoiceId" <> invoice."id" OR NEW."signedAmount" = 0 OR NEW."signedAmount" <> invoice."obligationTotalSnapshot" - transferred - receipt."actualAmount" THEN
    RAISE EXCEPTION 'Settlement difference must be the non-zero invoice outstanding minus receipt delta';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
