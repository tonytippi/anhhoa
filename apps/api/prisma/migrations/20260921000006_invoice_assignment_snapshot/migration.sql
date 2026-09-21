ALTER TABLE "Invoice"
  ADD COLUMN "classAssignmentIdSnapshot" UUID,
  ADD COLUMN "classAssignmentEffectiveFromSnapshot" DATE,
  ADD COLUMN "classAssignmentEffectiveToSnapshot" DATE;

-- Existing deployments may already have Invoice rows. Their historical class-assignment
-- facts cannot be reconstructed safely, so retain NULL rather than inventing data.
-- The application supplies both fields for every newly generated Invoice.
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_class_assignment_snapshot_pair"
  CHECK (
    ("classAssignmentIdSnapshot" IS NULL AND "classAssignmentEffectiveFromSnapshot" IS NULL)
    OR ("classAssignmentIdSnapshot" IS NOT NULL AND "classAssignmentEffectiveFromSnapshot" IS NOT NULL)
  );
