DROP TRIGGER IF EXISTS collection_run_close_requires_terminal_invoices ON "CollectionRun";
DROP TRIGGER IF EXISTS invoice_insert_rejects_closed_collection_run ON "Invoice";

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
    WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" <> 'ISSUED'
  ) THEN
    RAISE EXCEPTION 'Cannot close CollectionRun with non-issued invoices';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_run_close_finality
  BEFORE UPDATE ON "CollectionRun"
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_run_close_finality();

CREATE OR REPLACE FUNCTION reject_invoice_for_closed_collection_run() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_mutation_rejects_closed_collection_run
  BEFORE INSERT OR UPDATE OF "schoolId", "collectionRunId", "status" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION reject_invoice_for_closed_collection_run();

CREATE OR REPLACE FUNCTION enforce_collection_run_transition() RETURNS trigger AS $$
DECLARE parent_status "CollectionRunStatus"; prior "CollectionRunLifecycleTransition"%ROWTYPE;
BEGIN
  SELECT "status" INTO parent_status FROM "CollectionRun"
  WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."collectionRunId" FOR UPDATE;
  IF NOT FOUND OR parent_status <> NEW."status" THEN
    RAISE EXCEPTION 'CollectionRun lifecycle transition does not match parent state';
  END IF;
  SELECT * INTO prior FROM "CollectionRunLifecycleTransition"
  WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."collectionRunId"
  ORDER BY "sequence" DESC LIMIT 1;
  IF NOT FOUND THEN
    IF NEW."sequence" <> 1 OR NEW."previousStatus" IS NOT NULL OR NEW."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Invalid initial CollectionRun lifecycle transition';
    END IF;
  ELSIF NEW."sequence" <> prior."sequence" + 1
    OR NEW."previousStatus" IS DISTINCT FROM prior."status"
    OR NOT ((prior."status" = 'DRAFT' AND NEW."status" = 'READY') OR (prior."status" = 'READY' AND NEW."status" = 'GENERATED') OR (prior."status" = 'GENERATED' AND NEW."status" = 'CLOSED')) THEN
    RAISE EXCEPTION 'Contradictory CollectionRun lifecycle transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_run_transition_consistency
  BEFORE INSERT ON "CollectionRunLifecycleTransition"
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_run_transition();
