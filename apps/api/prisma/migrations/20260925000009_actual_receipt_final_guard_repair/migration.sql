-- Upgrade databases may already have applied 00007; install the same
-- deterministic CLOSED/Receipt guard without inspecting function source text.
CREATE OR REPLACE FUNCTION enforce_closed_invoice_receipt() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED'
     AND NOT EXISTS (SELECT 1 FROM "Receipt" WHERE "schoolId" = NEW."schoolId" AND "invoiceId" = NEW."id") THEN
    RAISE EXCEPTION 'A CLOSED Invoice requires its Receipt in the same transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS closed_invoice_requires_receipt ON "Invoice";
CREATE TRIGGER closed_invoice_requires_receipt
  BEFORE UPDATE OF "status" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION enforce_closed_invoice_receipt();
