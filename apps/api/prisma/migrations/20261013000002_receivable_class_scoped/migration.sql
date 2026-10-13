-- Sprint change 2026-10-13: whether a FIXED Receivable applies to the whole School or only to its ReceivableClass rows is its own
-- fact, so a Class can leave a class-scoped Receivable (from the Class screen) without turning it into a whole-School one.
ALTER TABLE "Receivable" ADD COLUMN "classScoped" BOOLEAN NOT NULL DEFAULT false;
DO $$
BEGIN
  PERFORM set_config('passionedu.allow_history_cleanup', 'on', true);
  UPDATE "Receivable" r SET "classScoped" = true WHERE EXISTS (SELECT 1 FROM "ReceivableClass" c WHERE c."schoolId" = r."schoolId" AND c."receivableId" = r."id");
END;
$$;

CREATE OR REPLACE FUNCTION validate_receivable_class() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_kind "ReceivableGroupKind"; scoped BOOLEAN;
BEGIN
  SELECT g."kind", r."classScoped" INTO group_kind, scoped FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId" WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId";
  IF group_kind <> 'FIXED' OR NOT scoped THEN RAISE EXCEPTION 'Only a class-scoped FIXED Receivable is assigned to Classes'; END IF;
  RETURN NEW;
END;
$$;
