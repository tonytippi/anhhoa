CREATE OR REPLACE FUNCTION enforce_invoice_revision_completion() RETURNS trigger AS $$
DECLARE replacement "Invoice"%ROWTYPE; source "Invoice"%ROWTYPE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NULL; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND NEW."status" = 'ISSUED' THEN SELECT * INTO source FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."revisesInvoiceId"; IF NOT FOUND OR source."status" <> 'CANCELLED' THEN RAISE EXCEPTION 'Issued replacement requires its source to be cancelled atomically'; END IF; END IF;
  IF NEW."status" = 'CANCELLED' THEN
    SELECT * INTO replacement FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "revisesInvoiceId" = NEW."id";
    IF NOT FOUND OR (replacement."status" <> 'ISSUED' AND NOT (replacement."status" = 'CLOSED' AND EXISTS (SELECT 1 FROM "SettlementTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."id" AND "replacementInvoiceId" = replacement."id"))) THEN RAISE EXCEPTION 'Cancelled source requires its issued or settlement-transferred replacement'; END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
