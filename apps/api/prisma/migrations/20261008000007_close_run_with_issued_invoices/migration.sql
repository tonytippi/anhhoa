-- Decision 2026-10-08 (sprint-change-proposal-2026-10-08-run-lock-prior-debt-and-revision-discard.md, 1.1):
-- a CollectionRun is locked ("Dong dot thu") once every Invoice is issued. Receipts and payouts keep
-- settling ISSUED Invoices of a CLOSED run; everything else on a CLOSED run stays immutable.
-- Previous latest definitions: enforce_collection_run_close_finality from 20260925000006_actual_receipt_settlement_carry_repairs,
-- reject_invoice_for_closed_collection_run from 20260922000006_collection_run_terminal_and_normal_issue_finality.
CREATE OR REPLACE FUNCTION enforce_collection_run_close_finality() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND (OLD."schoolId", OLD."schoolYearId", OLD."type", OLD."billingMonth", OLD."status", OLD."version", OLD."createdAt") IS DISTINCT FROM (NEW."schoolId", NEW."schoolYearId", NEW."type", NEW."billingMonth", NEW."status", NEW."version", NEW."createdAt") THEN RAISE EXCEPTION 'CLOSED CollectionRun business data is immutable'; END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" <> 'GENERATED' THEN RAISE EXCEPTION 'CollectionRun can transition to CLOSED only from GENERATED'; END IF;
  IF NEW."status" = 'CLOSED' AND EXISTS (SELECT 1 FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" NOT IN ('ISSUED', 'CLOSED', 'CANCELLED') AND NOT ("status" = 'DRAFT' AND "total" = 0)) THEN RAISE EXCEPTION 'Cannot close CollectionRun with unissued invoices'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION reject_invoice_for_closed_collection_run() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus"; school_year_closed_at TIMESTAMPTZ;
BEGIN
  SELECT "status" INTO run_status FROM "CollectionRun"
  WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."collectionRunId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CollectionRun does not exist for Invoice';
  END IF;
  IF run_status = 'CLOSED' THEN
    -- The only change allowed after the lock is settlement: a Receipt or payout moves an ISSUED Invoice to CLOSED.
    IF TG_OP = 'UPDATE' AND OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED'
      AND OLD."schoolId" = NEW."schoolId" AND OLD."collectionRunId" = NEW."collectionRunId" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot mutate Invoice for CLOSED CollectionRun';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'DRAFT' AND NEW."status" = 'ISSUED' AND NEW."revisesInvoiceId" IS NULL THEN
    SELECT "closedAt" INTO school_year_closed_at FROM "SchoolYear"
    WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."schoolYearId"
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SchoolYear does not exist for Invoice';
    END IF;
    IF school_year_closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot issue normal Invoice for CLOSED SchoolYear';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
