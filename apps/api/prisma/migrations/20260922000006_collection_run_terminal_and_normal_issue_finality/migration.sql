CREATE OR REPLACE FUNCTION enforce_collection_run_close_finality() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND (
    OLD."schoolId" IS DISTINCT FROM NEW."schoolId"
    OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId"
    OR OLD."type" IS DISTINCT FROM NEW."type"
    OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth"
    OR OLD."status" IS DISTINCT FROM NEW."status"
    OR OLD."version" IS DISTINCT FROM NEW."version"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  ) THEN
    RAISE EXCEPTION 'CLOSED CollectionRun business data is immutable';
  END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" <> 'GENERATED' THEN
    RAISE EXCEPTION 'CollectionRun can transition to CLOSED only from GENERATED';
  END IF;
  IF NEW."status" = 'CLOSED' AND EXISTS (
    SELECT 1 FROM "Invoice"
    WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" NOT IN ('ISSUED', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Cannot close CollectionRun with non-terminal invoices';
  END IF;
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
