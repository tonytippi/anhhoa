-- Decision 2026-10-06 (extracurricular-class-receivable-edit): an extracurricular class may change its name and its Receivable (with reason
-- and audit in the API). Every other column stays append-only. Generated invoice lines snapshot Receivable, price and classes, so no history
-- is rewritten.
CREATE OR REPLACE FUNCTION reject_extracurricular_class_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'name' - 'receivableId') = (to_jsonb(NEW) - 'name' - 'receivableId') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Extracurricular class history is append-only; only the name and Receivable may change';
END;
$$;

-- The new Receivable must satisfy the same rule as on insert: same School, EXTRACURRICULAR kind, latest lifecycle ACTIVE.
CREATE TRIGGER extracurricular_class_receivable_kind_update BEFORE UPDATE OF "receivableId" ON "ExtracurricularClass" FOR EACH ROW
  WHEN (OLD."receivableId" IS DISTINCT FROM NEW."receivableId") EXECUTE FUNCTION validate_extracurricular_class_receivable();
