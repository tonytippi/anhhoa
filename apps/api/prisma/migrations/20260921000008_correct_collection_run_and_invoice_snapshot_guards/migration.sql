-- Correct definitions that may be stale where the original migrations were already recorded.
ALTER TABLE "CollectionRunLifecycleTransition"
  DROP CONSTRAINT IF EXISTS "CollectionRunLifecycleTransition_valid";

ALTER TABLE "CollectionRunLifecycleTransition"
  ADD CONSTRAINT "CollectionRunLifecycleTransition_valid" CHECK (
    ("previousStatus" IS NULL AND "status" = 'DRAFT')
    OR ("previousStatus" = 'DRAFT' AND "status" = 'READY')
    OR ("previousStatus" = 'READY' AND "status" = 'GENERATED')
    OR ("previousStatus" = 'GENERATED' AND "status" = 'CLOSED')
  );

CREATE OR REPLACE FUNCTION reject_invoice_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Invoice deletion is forbidden';
  END IF;
  IF OLD."schoolId" IS DISTINCT FROM NEW."schoolId"
    OR OLD."studentId" IS DISTINCT FROM NEW."studentId"
    OR OLD."collectionRunId" IS DISTINCT FROM NEW."collectionRunId"
    OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId"
    OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth"
    OR OLD."rosterAsOf" IS DISTINCT FROM NEW."rosterAsOf"
    OR OLD."studentCodeSnapshot" IS DISTINCT FROM NEW."studentCodeSnapshot"
    OR OLD."studentNameSnapshot" IS DISTINCT FROM NEW."studentNameSnapshot"
    OR OLD."enrollmentIdSnapshot" IS DISTINCT FROM NEW."enrollmentIdSnapshot"
    OR OLD."enrollmentLifecycleSnapshot" IS DISTINCT FROM NEW."enrollmentLifecycleSnapshot"
    OR OLD."enrollmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."enrollmentEffectiveFromSnapshot"
    OR OLD."enrollmentEndedOnSnapshot" IS DISTINCT FROM NEW."enrollmentEndedOnSnapshot"
    OR OLD."classAssignmentIdSnapshot" IS DISTINCT FROM NEW."classAssignmentIdSnapshot"
    OR OLD."classAssignmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot"
    OR OLD."classAssignmentEffectiveToSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot"
    OR OLD."classIdSnapshot" IS DISTINCT FROM NEW."classIdSnapshot"
    OR OLD."classNameSnapshot" IS DISTINCT FROM NEW."classNameSnapshot"
    OR OLD."selectionProvenance" IS DISTINCT FROM NEW."selectionProvenance"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION 'Invoice roster snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_snapshot_immutable ON "Invoice";
CREATE TRIGGER invoice_snapshot_immutable
  BEFORE UPDATE OR DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION reject_invoice_snapshot_mutation();
