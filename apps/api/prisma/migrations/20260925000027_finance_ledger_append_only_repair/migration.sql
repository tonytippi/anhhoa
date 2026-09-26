ALTER TABLE "FinanceLedgerEvent"
  DROP CONSTRAINT IF EXISTS "FinanceLedgerEvent_schoolId_invoiceId_fkey";

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceLedgerEvent_schoolId_id_key" ON "FinanceLedgerEvent"("schoolId", "id");

CREATE OR REPLACE FUNCTION reject_finance_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Finance ledger is append-only';
END;
$$;
DROP TRIGGER IF EXISTS "FinanceLedgerEvent_append_only" ON "FinanceLedgerEvent";
CREATE TRIGGER "FinanceLedgerEvent_append_only"
  BEFORE UPDATE OR DELETE ON "FinanceLedgerEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_finance_ledger_mutation();
