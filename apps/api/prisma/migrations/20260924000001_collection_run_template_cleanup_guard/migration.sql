CREATE OR REPLACE FUNCTION reject_collection_run_template_mutation() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
BEGIN
  IF current_setting('passionedu.allow_collection_run_template_cleanup', true) = 'on' THEN
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
