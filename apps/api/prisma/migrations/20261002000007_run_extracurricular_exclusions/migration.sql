-- Story 5.36: per-run exclusion of a whole extracurricular class and the run's extracurricular snapshot.
ALTER TABLE "CollectionRun" ADD COLUMN "extracurricularSnapshot" JSONB;

CREATE TABLE "CollectionRunExtracurricularExclusion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "collectionRunId" UUID NOT NULL,
  "extracurricularClassId" UUID NOT NULL,
  "reason" TEXT,
  "actorIdentityId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionRunExtracurricularExclusion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunExtracurricularExclusion_run_fkey" FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CollectionRunExtracurricularExclusion_class_fkey" FOREIGN KEY ("schoolId", "extracurricularClassId") REFERENCES "ExtracurricularClass"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectionRunExtracurricularExclusion_run_class_key" ON "CollectionRunExtracurricularExclusion"("schoolId", "collectionRunId", "extracurricularClassId");
CREATE INDEX "CollectionRunExtracurricularExclusion_class_idx" ON "CollectionRunExtracurricularExclusion"("schoolId", "extracurricularClassId");

-- Only a DRAFT run changes its exclusions, and the class must belong to the run's SchoolYear.
CREATE OR REPLACE FUNCTION guard_run_extracurricular_exclusion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target RECORD;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'A run exclusion is added or removed, never edited'; END IF;
  target := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF NOT EXISTS (SELECT 1 FROM "CollectionRun" r WHERE r."schoolId" = target."schoolId" AND r."id" = target."collectionRunId" AND r."status" = 'DRAFT') THEN
    RAISE EXCEPTION 'Extracurricular exclusions can only change while the collection run is DRAFT';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "CollectionRun" r JOIN "ExtracurricularClass" c ON c."schoolId" = r."schoolId" AND c."schoolYearId" = r."schoolYearId"
    WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."collectionRunId" AND c."id" = NEW."extracurricularClassId"
  ) THEN RAISE EXCEPTION 'The extracurricular class must belong to the run SchoolYear'; END IF;
  RETURN target;
END;
$$;
CREATE TRIGGER collection_run_extracurricular_exclusion_guard BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunExtracurricularExclusion" FOR EACH ROW EXECUTE FUNCTION guard_run_extracurricular_exclusion();
