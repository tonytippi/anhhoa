-- Story 5.35 (decision 2026-10-02 §3.2): typed template lines with a scope, and immutable InvoiceLine provenance.
CREATE TYPE "TemplateScopeType" AS ENUM ('ALL', 'CLASSES', 'STUDENTS');
CREATE TYPE "InvoiceLineSourceKind" AS ENUM ('TEMPLATE_FIXED', 'TEMPLATE_FLEXIBLE', 'EXTRACURRICULAR', 'MANUAL');

ALTER TABLE "CollectionRunTemplateLine" ADD COLUMN "scopeType" "TemplateScopeType" NOT NULL DEFAULT 'ALL';
ALTER TABLE "InvoiceLine" ADD COLUMN "sourceKind" "InvoiceLineSourceKind", ADD COLUMN "sourceDetail" JSONB;

CREATE TABLE "CollectionRunTemplateScopeClass" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolYearId" UUID NOT NULL,
  "templateLineId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  CONSTRAINT "CollectionRunTemplateScopeClass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunTemplateScopeClass_line_fkey" FOREIGN KEY ("schoolId", "templateLineId") REFERENCES "CollectionRunTemplateLine"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CollectionRunTemplateScopeClass_class_fkey" FOREIGN KEY ("schoolId", "schoolYearId", "classId") REFERENCES "Class"("schoolId", "schoolYearId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectionRunTemplateScopeClass_schoolId_templateLineId_classId_key" ON "CollectionRunTemplateScopeClass"("schoolId", "templateLineId", "classId");
CREATE INDEX "CollectionRunTemplateScopeClass_schoolId_classId_idx" ON "CollectionRunTemplateScopeClass"("schoolId", "classId");

CREATE TABLE "CollectionRunTemplateScopeStudent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "templateLineId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  CONSTRAINT "CollectionRunTemplateScopeStudent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionRunTemplateScopeStudent_line_fkey" FOREIGN KEY ("schoolId", "templateLineId") REFERENCES "CollectionRunTemplateLine"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CollectionRunTemplateScopeStudent_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectionRunTemplateScopeStudent_schoolId_templateLineId_studentId_key" ON "CollectionRunTemplateScopeStudent"("schoolId", "templateLineId", "studentId");
CREATE INDEX "CollectionRunTemplateScopeStudent_schoolId_studentId_idx" ON "CollectionRunTemplateScopeStudent"("schoolId", "studentId");

-- A template line never uses an EXTRACURRICULAR Receivable (those bill through extracurricular classes) and a FIXED one is always ALL.
CREATE OR REPLACE FUNCTION validate_template_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_kind "ReceivableGroupKind";
BEGIN
  SELECT g."kind" INTO group_kind FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId" WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId";
  IF group_kind = 'EXTRACURRICULAR' THEN RAISE EXCEPTION 'A collection template line cannot use an EXTRACURRICULAR Receivable'; END IF;
  IF group_kind = 'FIXED' AND NEW."scopeType" <> 'ALL' THEN RAISE EXCEPTION 'A FIXED template line always applies to everyone'; END IF;
  IF TG_OP = 'UPDATE' AND NEW."scopeType" <> OLD."scopeType" AND (
    EXISTS (SELECT 1 FROM "CollectionRunTemplateScopeClass" c WHERE c."schoolId" = NEW."schoolId" AND c."templateLineId" = NEW."id")
    OR EXISTS (SELECT 1 FROM "CollectionRunTemplateScopeStudent" s WHERE s."schoolId" = NEW."schoolId" AND s."templateLineId" = NEW."id")
  ) THEN RAISE EXCEPTION 'Clear the scope targets before changing the scope type'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collection_run_template_line_scope BEFORE INSERT OR UPDATE OF "receivableId", "scopeType" ON "CollectionRunTemplateLine" FOR EACH ROW EXECUTE FUNCTION validate_template_line_scope();

CREATE OR REPLACE FUNCTION validate_template_scope_class() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "CollectionRunTemplateLine" l JOIN "CollectionRun" r ON r."schoolId" = l."schoolId" AND r."id" = l."collectionRunId"
    WHERE l."schoolId" = NEW."schoolId" AND l."id" = NEW."templateLineId" AND l."scopeType" = 'CLASSES' AND r."schoolYearId" = NEW."schoolYearId"
  ) THEN RAISE EXCEPTION 'A class scope target needs a CLASSES template line of the same SchoolYear'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collection_run_template_scope_class BEFORE INSERT ON "CollectionRunTemplateScopeClass" FOR EACH ROW EXECUTE FUNCTION validate_template_scope_class();

CREATE OR REPLACE FUNCTION validate_template_scope_student() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "CollectionRunTemplateLine" l JOIN "CollectionRun" r ON r."schoolId" = l."schoolId" AND r."id" = l."collectionRunId"
    JOIN "StudentEnrollment" e ON e."schoolId" = r."schoolId" AND e."schoolYearId" = r."schoolYearId" AND e."studentId" = NEW."studentId"
    WHERE l."schoolId" = NEW."schoolId" AND l."id" = NEW."templateLineId" AND l."scopeType" = 'STUDENTS'
  ) THEN RAISE EXCEPTION 'A Student scope target needs a STUDENTS template line and an enrollment in the run SchoolYear'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collection_run_template_scope_student BEFORE INSERT ON "CollectionRunTemplateScopeStudent" FOR EACH ROW EXECUTE FUNCTION validate_template_scope_student();

-- Provenance is a snapshot: it never changes after the line is written.
CREATE OR REPLACE FUNCTION keep_invoice_line_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."sourceKind" IS DISTINCT FROM OLD."sourceKind" OR NEW."sourceDetail" IS DISTINCT FROM OLD."sourceDetail" THEN
    RAISE EXCEPTION 'InvoiceLine provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_line_source_immutable BEFORE UPDATE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION keep_invoice_line_source();
