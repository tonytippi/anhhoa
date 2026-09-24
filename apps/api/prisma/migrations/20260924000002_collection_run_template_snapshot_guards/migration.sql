CREATE OR REPLACE FUNCTION reject_collection_run_template_mutation() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT "status" INTO run_status FROM "CollectionRun"
  WHERE "id" = COALESCE(NEW."collectionRunId", OLD."collectionRunId")
    AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId");
  IF run_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'CollectionRun template is immutable outside DRAFT';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION require_collection_run_template_snapshot() RETURNS trigger AS $$
BEGIN
  IF NEW."status" IN ('GENERATED', 'CLOSED') AND (NEW."templateSnapshot" IS NULL OR jsonb_array_length(NEW."templateSnapshot") = 0) THEN
    RAISE EXCEPTION 'CollectionRun requires a nonempty template snapshot after generation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS collection_run_template_snapshot_required ON "CollectionRun";
CREATE TRIGGER collection_run_template_snapshot_required BEFORE UPDATE ON "CollectionRun" FOR EACH ROW EXECUTE FUNCTION require_collection_run_template_snapshot();
