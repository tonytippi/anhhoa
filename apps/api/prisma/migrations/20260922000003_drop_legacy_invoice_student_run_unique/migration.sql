-- Some databases applied the initial revision migration before the legacy
-- constraint name was discovered; remove it idempotently for both upgrade paths.
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_student_run_unique";
