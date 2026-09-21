-- Bind every invoice's copied run facts to its actual same-School CollectionRun.
ALTER TABLE "CollectionRun"
  ADD CONSTRAINT "CollectionRun_schoolId_id_schoolYearId_billingMonth_key"
  UNIQUE ("schoolId", "id", "schoolYearId", "billingMonth");

ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_run_fkey";
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_run_snapshot_fkey"
  FOREIGN KEY ("schoolId", "collectionRunId", "schoolYearId", "billingMonth")
  REFERENCES "CollectionRun"("schoolId", "id", "schoolYearId", "billingMonth") ON DELETE RESTRICT;

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

CREATE TRIGGER invoice_snapshot_immutable
BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION reject_invoice_snapshot_mutation();

CREATE OR REPLACE FUNCTION reject_generated_run_selection_mutation() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO run_status FROM "CollectionRun"
  WHERE id = COALESCE(NEW."collectionRunId", OLD."collectionRunId")
    AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId");
  IF run_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Generated CollectionRun selections are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_run_selection_immutable_after_draft
BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunSelection"
FOR EACH ROW EXECUTE FUNCTION reject_generated_run_selection_mutation();
