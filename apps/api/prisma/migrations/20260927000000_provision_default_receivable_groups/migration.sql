ALTER TABLE "ReceivableGroupLifecycleTransition"
  DROP CONSTRAINT "ReceivableGroupLifecycleTransition_membership_fkey";

ALTER TABLE "ReceivableGroupLifecycleTransition"
  ALTER COLUMN "membershipId" DROP NOT NULL;

ALTER TABLE "ReceivableGroupLifecycleTransition"
  ADD CONSTRAINT "ReceivableGroupLifecycleTransition_membership_fkey"
  FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION "validate_receivable_group_transition_provenance"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."membershipId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Operation" AS operation
    WHERE operation."id" = NEW."operationId"
      AND operation."schoolId" = NEW."schoolId"
      AND operation."actorType" = 'PLATFORM_OPERATOR_GRANT'
      AND operation."platformOperatorGrantId" IS NOT NULL
      AND operation."actorIdentityId" = NEW."actorIdentityId"
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ReceivableGroupLifecycleTransition without membership requires a same-School Platform Operator Operation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReceivableGroupLifecycleTransition_validate_provenance"
  BEFORE INSERT OR UPDATE OF "schoolId", "actorIdentityId", "membershipId", "operationId"
  ON "ReceivableGroupLifecycleTransition"
  FOR EACH ROW EXECUTE FUNCTION "validate_receivable_group_transition_provenance"();
