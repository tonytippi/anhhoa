-- Story 5.33 (decision 2026-10-02): every School has exactly three typed, immutable receivable groups.
CREATE TYPE "ReceivableGroupKind" AS ENUM ('FIXED', 'FLEXIBLE', 'EXTRACURRICULAR');
ALTER TABLE "ReceivableGroup" ADD COLUMN "kind" "ReceivableGroupKind";

-- Groups stay append-only; only the normalisation below (history cleanup mode) may rename, retype or delete them.
-- The previous function returned OLD for UPDATE, which silently discarded the change.
CREATE OR REPLACE FUNCTION reject_receivable_group_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'Receivable groups are fixed: the three kinds cannot be renamed, retyped or removed';
END;
$$;
DROP TRIGGER receivable_group_append_only ON "ReceivableGroup";
CREATE TRIGGER receivable_group_append_only BEFORE UPDATE OR DELETE ON "ReceivableGroup" FOR EACH ROW EXECUTE FUNCTION reject_receivable_group_mutation();

-- Idempotent, per-School normalisation. Kept after the migration so the integration suite can replay it on legacy-shaped data.
--  * "Khoản thu chung" -> FIXED, "Khoản thu đột xuất" -> FLEXIBLE, "Ngoại khóa" -> EXTRACURRICULAR (renamed to the fixed names).
--  * Any other (custom) group is removed from the catalog: its Receivables move to FLEXIBLE, its lifecycle history is deleted with it
--    (hard delete is possible in history cleanup mode) and the removed group id/name/receivables are kept in the AuditRecord.
--  * Missing kinds are created, so every School ends with exactly three groups.
-- No Operation is written: an Operation needs a School membership or Platform Operator grant actor, which a migration does not have;
-- the AuditRecord carries untyped (NULL actor) provenance like earlier migration audits.
CREATE OR REPLACE FUNCTION normalize_receivable_groups() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  kinds "ReceivableGroupKind"[] := ARRAY['FIXED', 'FLEXIBLE', 'EXTRACURRICULAR']::"ReceivableGroupKind"[];
  fixed_names text[] := ARRAY['Khoản thu cố định', 'Khoản thu linh hoạt', 'Ngoại khóa'];
  legacy_names text[] := ARRAY['Khoản thu chung', 'Khoản thu đột xuất', 'Ngoại khóa'];
  school_id uuid;
  canonical uuid[];
  found uuid;
  custom RECORD;
  moved uuid[];
  changes jsonb;
  removed jsonb;
  created jsonb;
  i integer;
BEGIN
  PERFORM set_config('passionedu.allow_history_cleanup', 'on', true);
  FOR school_id IN SELECT "id" FROM "School" ORDER BY "id" LOOP
    changes := '[]'::jsonb; removed := '[]'::jsonb; created := '[]'::jsonb; canonical := ARRAY[NULL, NULL, NULL]::uuid[];
    -- 1. pick the canonical group per kind: already typed, else legacy name, else the exact fixed name, else create it.
    FOR i IN 1..3 LOOP
      SELECT g."id" INTO found FROM "ReceivableGroup" g WHERE g."schoolId" = school_id AND g."kind" = kinds[i];
      IF found IS NULL THEN
        SELECT g."id" INTO found FROM "ReceivableGroup" g WHERE g."schoolId" = school_id AND g."kind" IS NULL AND g."name" = legacy_names[i];
      END IF;
      IF found IS NULL THEN
        SELECT g."id" INTO found FROM "ReceivableGroup" g WHERE g."schoolId" = school_id AND g."kind" IS NULL AND g."name" = fixed_names[i];
      END IF;
      IF found IS NULL THEN
        INSERT INTO "ReceivableGroup" ("id", "schoolId", "name", "kind") VALUES (gen_random_uuid(), school_id, fixed_names[i], kinds[i]) RETURNING "id" INTO found;
        created := created || jsonb_build_object('groupId', found, 'kind', kinds[i]);
      END IF;
      canonical[i] := found;
    END LOOP;
    -- 2. remove every other untyped group, moving its Receivables to FLEXIBLE.
    FOR custom IN
      SELECT g."id", g."name" FROM "ReceivableGroup" g WHERE g."schoolId" = school_id AND g."kind" IS NULL AND g."id" <> ALL (canonical) ORDER BY g."id"
    LOOP
      SELECT coalesce(array_agg(r."id" ORDER BY r."id"), ARRAY[]::uuid[]) INTO moved FROM "Receivable" r WHERE r."schoolId" = school_id AND r."groupId" = custom."id";
      UPDATE "Receivable" SET "groupId" = canonical[2] WHERE "schoolId" = school_id AND "groupId" = custom."id";
      DELETE FROM "ReceivableGroupLifecycleTransition" WHERE "schoolId" = school_id AND "receivableGroupId" = custom."id";
      DELETE FROM "ReceivableGroup" WHERE "schoolId" = school_id AND "id" = custom."id";
      removed := removed || jsonb_build_object('groupId', custom."id", 'name', custom."name", 'movedReceivableIds', to_jsonb(moved), 'movedToKind', 'FLEXIBLE');
    END LOOP;
    -- 3. rename and type the canonical groups (names are free now that conflicting custom groups are gone).
    FOR i IN 1..3 LOOP
      IF EXISTS (SELECT 1 FROM "ReceivableGroup" g WHERE g."id" = canonical[i] AND (g."kind" IS DISTINCT FROM kinds[i] OR g."name" <> fixed_names[i])) THEN
        SELECT changes || jsonb_build_object('groupId', g."id", 'previousName', g."name", 'name', fixed_names[i], 'kind', kinds[i]) INTO changes FROM "ReceivableGroup" g WHERE g."id" = canonical[i];
        UPDATE "ReceivableGroup" SET "name" = fixed_names[i], "kind" = kinds[i] WHERE "id" = canonical[i];
      END IF;
    END LOOP;
    IF jsonb_array_length(changes) + jsonb_array_length(removed) + jsonb_array_length(created) > 0 THEN
      INSERT INTO "AuditRecord" ("id", "schoolId", "action", "reason", "provenance")
      VALUES (gen_random_uuid(), school_id, 'RECEIVABLE_GROUPS_NORMALIZED', 'Story 5.33: three fixed receivable group kinds',
        jsonb_build_object('migration', '20261002000001_fixed_receivable_group_kinds', 'typedGroups', changes, 'createdGroups', created, 'removedGroups', removed));
    END IF;
  END LOOP;
  PERFORM set_config('passionedu.allow_history_cleanup', 'off', true);
END;
$$;

SELECT normalize_receivable_groups();

ALTER TABLE "ReceivableGroup" ALTER COLUMN "kind" SET NOT NULL;
CREATE UNIQUE INDEX "ReceivableGroup_schoolId_kind_key" ON "ReceivableGroup"("schoolId", "kind");
ALTER TABLE "ReceivableGroup" ADD CONSTRAINT "ReceivableGroup_fixed_name" CHECK (
  ("kind" = 'FIXED' AND "name" = 'Khoản thu cố định')
  OR ("kind" = 'FLEXIBLE' AND "name" = 'Khoản thu linh hoạt')
  OR ("kind" = 'EXTRACURRICULAR' AND "name" = 'Ngoại khóa')
);

-- A Receivable may change group (= kind) only while no InvoiceLine or CollectionRun template line uses it.
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice' - 'groupId') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice' - 'groupId') THEN
    IF NEW."groupId" <> OLD."groupId" AND (
      EXISTS (SELECT 1 FROM "InvoiceLine" l WHERE l."schoolId" = OLD."schoolId" AND l."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "CollectionRunTemplateLine" t WHERE t."schoolId" = OLD."schoolId" AND t."receivableId" = OLD."id")
    ) THEN
      RAISE EXCEPTION 'Receivable kind cannot change once the Receivable is used on an Invoice or collection template';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;
