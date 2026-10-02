-- Story 5.35 review fixes: template scope targets are guarded on every write and the scope shape is enforced at commit.

-- 1. One guard for both target tables. It resolves the parent line and run through School-scoped keys, requires a DRAFT run for any
--    insert, update or delete, and re-validates the target semantics on insert and update.
DROP TRIGGER collection_run_template_scope_class ON "CollectionRunTemplateScopeClass";
DROP TRIGGER collection_run_template_scope_student ON "CollectionRunTemplateScopeStudent";

CREATE OR REPLACE FUNCTION guard_template_scope_target() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  school_id uuid;
  line_ids uuid[] := ARRAY[]::uuid[];
  line_id uuid;
  info RECORD;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN school_id := OLD."schoolId"; line_ids := line_ids || OLD."templateLineId"; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN school_id := NEW."schoolId"; line_ids := line_ids || NEW."templateLineId"; END IF;
  IF TG_OP = 'UPDATE' AND OLD."schoolId" <> NEW."schoolId" THEN RAISE EXCEPTION 'A template scope target cannot move between Schools'; END IF;
  FOREACH line_id IN ARRAY line_ids LOOP
    SELECT l."scopeType" AS scope_type, r."status" AS run_status, r."schoolYearId" AS run_year INTO info
      FROM "CollectionRunTemplateLine" l JOIN "CollectionRun" r ON r."schoolId" = l."schoolId" AND r."id" = l."collectionRunId"
      WHERE l."schoolId" = school_id AND l."id" = line_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A template scope target needs a template line of the same School'; END IF;
    IF info.run_status <> 'DRAFT' THEN RAISE EXCEPTION 'Template scope targets can only change while the collection run is DRAFT'; END IF;
  END LOOP;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT l."scopeType" AS scope_type, r."schoolYearId" AS run_year INTO info
      FROM "CollectionRunTemplateLine" l JOIN "CollectionRun" r ON r."schoolId" = l."schoolId" AND r."id" = l."collectionRunId"
      WHERE l."schoolId" = NEW."schoolId" AND l."id" = NEW."templateLineId";
    IF TG_TABLE_NAME = 'CollectionRunTemplateScopeClass' THEN
      IF info.scope_type <> 'CLASSES' OR info.run_year <> NEW."schoolYearId" THEN
        RAISE EXCEPTION 'A class scope target needs a CLASSES template line of the same SchoolYear';
      END IF;
    ELSE
      IF info.scope_type <> 'STUDENTS' OR NOT EXISTS (
        SELECT 1 FROM "StudentEnrollment" e WHERE e."schoolId" = NEW."schoolId" AND e."schoolYearId" = info.run_year AND e."studentId" = NEW."studentId"
      ) THEN
        RAISE EXCEPTION 'A Student scope target needs a STUDENTS template line and an enrollment in the run SchoolYear';
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER collection_run_template_scope_class_guard BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunTemplateScopeClass" FOR EACH ROW EXECUTE FUNCTION guard_template_scope_target();
CREATE TRIGGER collection_run_template_scope_student_guard BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunTemplateScopeStudent" FOR EACH ROW EXECUTE FUNCTION guard_template_scope_target();

-- 2. Shape, checked at commit so a line and its targets can be rewritten together:
--    ALL -> no targets; CLASSES -> at least one class target and no student target; STUDENTS -> the mirror image.
CREATE OR REPLACE FUNCTION check_template_scope_shape() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  school_id uuid;
  line_ids uuid[] := ARRAY[]::uuid[];
  line_id uuid;
  line_type "TemplateScopeType";
  class_count integer;
  student_count integer;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'CollectionRunTemplateLine' THEN
    school_id := NEW."schoolId"; line_ids := ARRAY[NEW."id"];
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN school_id := OLD."schoolId"; line_ids := line_ids || OLD."templateLineId"; END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN school_id := NEW."schoolId"; line_ids := line_ids || NEW."templateLineId"; END IF;
  END IF;
  FOREACH line_id IN ARRAY line_ids LOOP
    SELECT l."scopeType" INTO line_type FROM "CollectionRunTemplateLine" l WHERE l."schoolId" = school_id AND l."id" = line_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*) INTO class_count FROM "CollectionRunTemplateScopeClass" c WHERE c."schoolId" = school_id AND c."templateLineId" = line_id;
    SELECT count(*) INTO student_count FROM "CollectionRunTemplateScopeStudent" s WHERE s."schoolId" = school_id AND s."templateLineId" = line_id;
    IF (line_type = 'ALL' AND (class_count > 0 OR student_count > 0))
       OR (line_type = 'CLASSES' AND (class_count = 0 OR student_count > 0))
       OR (line_type = 'STUDENTS' AND (student_count = 0 OR class_count > 0)) THEN
      RAISE EXCEPTION 'Template scope % needs matching targets (classes %, students %)', line_type, class_count, student_count;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER collection_run_template_line_scope_shape AFTER INSERT OR UPDATE ON "CollectionRunTemplateLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_template_scope_shape();
CREATE CONSTRAINT TRIGGER collection_run_template_scope_class_shape AFTER INSERT OR UPDATE OR DELETE ON "CollectionRunTemplateScopeClass" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_template_scope_shape();
CREATE CONSTRAINT TRIGGER collection_run_template_scope_student_shape AFTER INSERT OR UPDATE OR DELETE ON "CollectionRunTemplateScopeStudent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_template_scope_shape();
