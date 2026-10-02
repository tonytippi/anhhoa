-- Story 5.34 review fixes.
-- 1. A class needs the latest same-School Receivable lifecycle to be ACTIVE (defense in depth for the API lock).
CREATE OR REPLACE FUNCTION validate_extracurricular_class_receivable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Receivable" r JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId"
    WHERE r."schoolId" = NEW."schoolId" AND r."id" = NEW."receivableId" AND g."kind" = 'EXTRACURRICULAR'
  ) THEN
    RAISE EXCEPTION 'An extracurricular class requires an EXTRACURRICULAR Receivable of the same School';
  END IF;
  IF current_setting('passionedu.allow_history_cleanup', true) IS DISTINCT FROM 'on' AND coalesce((
    SELECT t."status"::text FROM "ReceivableLifecycleTransition" t
    WHERE t."schoolId" = NEW."schoolId" AND t."receivableId" = NEW."receivableId" ORDER BY t."sequence" DESC LIMIT 1
  ), '') <> 'ACTIVE' THEN
    RAISE EXCEPTION 'An extracurricular class requires an ACTIVE Receivable';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. End provenance is all-null (open) or all-set (ended through the end command).
ALTER TABLE "ExtracurricularMembership" ADD CONSTRAINT "ExtracurricularMembership_end_provenance_complete" CHECK (
  ("endReason" IS NULL AND "endedByMembershipId" IS NULL AND "endOperationId" IS NULL AND "endedAt" IS NULL)
  OR ("endReason" IS NOT NULL AND "endedByMembershipId" IS NOT NULL AND "endOperationId" IS NOT NULL AND "endedAt" IS NOT NULL AND "effectiveTo" IS NOT NULL)
);

-- 2. A membership stays inside its enrollment's effective interval (both half-open: endedOn is the first day without enrollment).
--    Later roster withdrawal is not blocked; the run's eligibility (Story 5.36) excludes non-enrolled Students.
CREATE OR REPLACE FUNCTION guard_extracurricular_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE enrollment RECORD;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT e."effectiveFrom", e."endedOn" INTO enrollment FROM "StudentEnrollment" e WHERE e."schoolId" = NEW."schoolId" AND e."id" = NEW."enrollmentId";
    IF NEW."effectiveFrom" < enrollment."effectiveFrom" OR (enrollment."endedOn" IS NOT NULL AND (NEW."effectiveTo" IS NULL OR NEW."effectiveTo" > enrollment."endedOn")) THEN
      RAISE EXCEPTION 'An extracurricular membership must stay inside its enrollment interval';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF coalesce((SELECT t."status"::text FROM "ExtracurricularClassLifecycleTransition" t WHERE t."schoolId" = NEW."schoolId" AND t."extracurricularClassId" = NEW."extracurricularClassId" ORDER BY t."sequence" DESC LIMIT 1), '') <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Memberships can only be added to an ACTIVE extracurricular class';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."effectiveTo" IS NULL AND NEW."effectiveTo" IS NOT NULL
     AND (to_jsonb(OLD) - 'effectiveTo' - 'endReason' - 'endedByMembershipId' - 'endOperationId' - 'endedAt') = (to_jsonb(NEW) - 'effectiveTo' - 'endReason' - 'endedByMembershipId' - 'endOperationId' - 'endedAt')
     AND NEW."endReason" IS NOT NULL AND NEW."endedByMembershipId" IS NOT NULL AND NEW."endOperationId" IS NOT NULL AND NEW."endedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Extracurricular memberships are append-only; an open membership can only be ended with its complete end provenance';
END;
$$;
