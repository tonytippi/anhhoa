-- Sprint change 2026-10-12: the close guard compared the dropped "type" column; a CLOSED run now keeps its scope, Class, name and period.
-- Previous latest definition: enforce_collection_run_close_finality from 20261008000007_close_run_with_issued_invoices.
CREATE OR REPLACE FUNCTION enforce_collection_run_close_finality() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND (OLD."schoolId", OLD."schoolYearId", OLD."scope", OLD."classId", OLD."name", OLD."periodStartsOn", OLD."periodEndsOn", OLD."billingMonth", OLD."status", OLD."version", OLD."createdAt") IS DISTINCT FROM (NEW."schoolId", NEW."schoolYearId", NEW."scope", NEW."classId", NEW."name", NEW."periodStartsOn", NEW."periodEndsOn", NEW."billingMonth", NEW."status", NEW."version", NEW."createdAt") THEN RAISE EXCEPTION 'CLOSED CollectionRun business data is immutable'; END IF;
  IF NEW."status" = 'CLOSED' AND OLD."status" <> 'GENERATED' THEN RAISE EXCEPTION 'CollectionRun can transition to CLOSED only from GENERATED'; END IF;
  IF NEW."status" = 'CLOSED' AND EXISTS (SELECT 1 FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "collectionRunId" = NEW."id" AND "status" NOT IN ('ISSUED', 'CLOSED', 'CANCELLED') AND NOT ("status" = 'DRAFT' AND "total" = 0)) THEN RAISE EXCEPTION 'Cannot close CollectionRun with unissued invoices'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
