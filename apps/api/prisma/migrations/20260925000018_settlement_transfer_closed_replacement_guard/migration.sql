CREATE OR REPLACE FUNCTION enforce_closed_invoice_receipt() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED' AND NOT EXISTS (SELECT 1 FROM "Receipt" WHERE "schoolId" = NEW."schoolId" AND "invoiceId" = NEW."id") AND NOT EXISTS (SELECT 1 FROM "SettlementTransfer" WHERE "schoolId" = NEW."schoolId" AND "replacementInvoiceId" = NEW."id") THEN
    RAISE EXCEPTION 'A CLOSED Invoice requires its Receipt or settlement transfer in the same transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
