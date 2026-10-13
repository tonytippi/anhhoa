-- Sprint change 2026-10-13: a FIXED Receivable applies to the whole School (no rows here) or to the Classes listed here.
-- A new collection run seeds it for those Classes only, so the FIXED template line may now carry a CLASSES scope.
CREATE TABLE "ReceivableClass" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "receivableId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivableClass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivableClass_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReceivableClass_receivable_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReceivableClass_class_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReceivableClass_schoolId_receivableId_classId_key" ON "ReceivableClass"("schoolId", "receivableId", "classId");
CREATE INDEX "ReceivableClass_schoolId_classId_idx" ON "ReceivableClass"("schoolId", "classId");

-- Only a FIXED Receivable is assigned to Classes; FLEXIBLE ones pick their scope on the run and EXTRACURRICULAR ones bill by membership.
CREATE FUNCTION validate_receivable_class() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_kind "ReceivableGroupKind";
BEGIN
  SELECT g."kind" INTO group_kind FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId" WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId";
  IF group_kind <> 'FIXED' THEN RAISE EXCEPTION 'Only a FIXED Receivable is assigned to Classes'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER receivable_class_kind BEFORE INSERT OR UPDATE ON "ReceivableClass" FOR EACH ROW EXECUTE FUNCTION validate_receivable_class();

-- The template line keeps refusing EXTRACURRICULAR Receivables and keeps the scope-change order; the FIXED = ALL rule is gone.
CREATE OR REPLACE FUNCTION validate_template_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_kind "ReceivableGroupKind";
BEGIN
  SELECT g."kind" INTO group_kind FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId" WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId";
  IF group_kind = 'EXTRACURRICULAR' THEN RAISE EXCEPTION 'A collection template line cannot use an EXTRACURRICULAR Receivable'; END IF;
  IF TG_OP = 'UPDATE' AND NEW."scopeType" <> OLD."scopeType" AND (
    EXISTS (SELECT 1 FROM "CollectionRunTemplateScopeClass" c WHERE c."schoolId" = NEW."schoolId" AND c."templateLineId" = NEW."id")
    OR EXISTS (SELECT 1 FROM "CollectionRunTemplateScopeStudent" s WHERE s."schoolId" = NEW."schoolId" AND s."templateLineId" = NEW."id")
  ) THEN RAISE EXCEPTION 'Clear the scope targets before changing the scope type'; END IF;
  RETURN NEW;
END;
$$;
