-- Sprint change 2026-10-17: per-run quantity (e.g. sessions) billed to each member of an extracurricular class. No row = quantity 1.
CREATE TABLE "CollectionRunExtracurricularQuantity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "extracurricularClassId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CollectionRunExtracurricularQuantity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunExtracurricularQuantity_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "CollectionRunExtracurricularQuantity_schoolId_collectionRunId_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CollectionRunExtracurricularQuantity_schoolId_extracurricularClassId_fkey" FOREIGN KEY ("schoolId", "extracurricularClassId") REFERENCES "ExtracurricularClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectionRunExtracurricularQuantity_schoolId_collectionRunId_extracurricularCla_key" ON "CollectionRunExtracurricularQuantity"("schoolId", "collectionRunId", "extracurricularClassId");
CREATE INDEX "CollectionRunExtracurricularQuantity_schoolId_extracurricularClassId_idx" ON "CollectionRunExtracurricularQuantity"("schoolId", "extracurricularClassId");

-- Same guard as run exclusions: only a DRAFT run changes its quantities, and the class must belong to the run's SchoolYear.
CREATE OR REPLACE FUNCTION guard_run_extracurricular_quantity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target RECORD;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  target := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'UPDATE' AND (NEW."schoolId", NEW."collectionRunId", NEW."extracurricularClassId") IS DISTINCT FROM (OLD."schoolId", OLD."collectionRunId", OLD."extracurricularClassId") THEN
    RAISE EXCEPTION 'A run quantity keeps its run and class';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "CollectionRun" r WHERE r."schoolId" = target."schoolId" AND r."id" = target."collectionRunId" AND r."status" = 'DRAFT') THEN
    RAISE EXCEPTION 'Extracurricular quantities can only change while the collection run is DRAFT';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "CollectionRun" r JOIN "ExtracurricularClass" c ON c."schoolId" = r."schoolId" AND c."schoolYearId" = r."schoolYearId"
    WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."collectionRunId" AND c."id" = NEW."extracurricularClassId"
  ) THEN RAISE EXCEPTION 'The extracurricular class must belong to the run SchoolYear'; END IF;
  RETURN target;
END;
$$;
CREATE TRIGGER collection_run_extracurricular_quantity_guard BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunExtracurricularQuantity" FOR EACH ROW EXECUTE FUNCTION guard_run_extracurricular_quantity();
