CREATE OR REPLACE FUNCTION reject_collection_run_close_with_draft_invoice() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND NEW."status" IS DISTINCT FROM 'CLOSED' THEN
    RAISE EXCEPTION 'CLOSED CollectionRun is immutable';
  END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" IS DISTINCT FROM 'CLOSED'
    AND EXISTS (SELECT 1 FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" = 'DRAFT') THEN
    RAISE EXCEPTION 'Cannot close CollectionRun with DRAFT invoices';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_run_close_requires_terminal_invoices
  BEFORE UPDATE OF "status" ON "CollectionRun"
  FOR EACH ROW EXECUTE FUNCTION reject_collection_run_close_with_draft_invoice();

CREATE OR REPLACE FUNCTION reject_invoice_for_closed_collection_run() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CollectionRun" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."collectionRunId" AND "status" = 'CLOSED') THEN
    RAISE EXCEPTION 'Cannot create Invoice for CLOSED CollectionRun';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_insert_rejects_closed_collection_run
  BEFORE INSERT ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION reject_invoice_for_closed_collection_run();
