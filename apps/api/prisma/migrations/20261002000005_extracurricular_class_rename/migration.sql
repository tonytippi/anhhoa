-- Business owner 2026-10-02: an extracurricular class may be renamed (with reason and audit in the API). Only "name" may change; the
-- class stays otherwise append-only. Generated invoice lines snapshot the name, so no history is rewritten.
CREATE OR REPLACE FUNCTION reject_extracurricular_class_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'name') = (to_jsonb(NEW) - 'name') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Extracurricular class history is append-only; only the name may change';
END;
$$;
DROP TRIGGER extracurricular_class_append_only ON "ExtracurricularClass";
CREATE TRIGGER extracurricular_class_append_only BEFORE UPDATE OR DELETE ON "ExtracurricularClass" FOR EACH ROW EXECUTE FUNCTION reject_extracurricular_class_mutation();
