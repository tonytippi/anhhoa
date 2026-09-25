ALTER TABLE "CollectionRun" ADD COLUMN "readyPreviewFingerprint" TEXT;

CREATE OR REPLACE FUNCTION reject_collection_run_template_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD."templateSnapshot" IS NOT NULL AND OLD."templateSnapshot" IS DISTINCT FROM NEW."templateSnapshot" THEN RAISE EXCEPTION 'CollectionRun template snapshot is immutable'; END IF;
  IF OLD."readyPreviewFingerprint" IS NOT NULL AND OLD."readyPreviewFingerprint" IS DISTINCT FROM NEW."readyPreviewFingerprint" THEN RAISE EXCEPTION 'CollectionRun READY preview fingerprint is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
