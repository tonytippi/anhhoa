ALTER TABLE "CollectionRun" ADD COLUMN "templateSnapshot" JSONB;

CREATE TABLE "CollectionRunTemplateLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "receivableId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionRunTemplateLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunTemplateLine_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "CollectionRunTemplateLine_unique_receivable" UNIQUE ("schoolId", "collectionRunId", "receivableId"),
  CONSTRAINT "CollectionRunTemplateLine_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "CollectionRunTemplateLine_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunTemplateLine_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "CollectionRunTemplateLine_receivable_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CollectionRunTemplateLine_run_idx" ON "CollectionRunTemplateLine" ("schoolId", "collectionRunId");

CREATE OR REPLACE FUNCTION reject_collection_run_template_mutation() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
BEGIN
  IF current_setting('passionedu.allow_collection_run_template_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT "status" INTO run_status FROM "CollectionRun" WHERE "id" = COALESCE(NEW."collectionRunId", OLD."collectionRunId") AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId");
  IF run_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'CollectionRun template is immutable outside DRAFT'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER collection_run_template_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunTemplateLine" FOR EACH ROW EXECUTE FUNCTION reject_collection_run_template_mutation();

CREATE OR REPLACE FUNCTION reject_collection_run_template_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD."templateSnapshot" IS NOT NULL AND OLD."templateSnapshot" IS DISTINCT FROM NEW."templateSnapshot" THEN RAISE EXCEPTION 'CollectionRun template snapshot is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER collection_run_template_snapshot_immutable BEFORE UPDATE ON "CollectionRun" FOR EACH ROW EXECUTE FUNCTION reject_collection_run_template_snapshot_mutation();
