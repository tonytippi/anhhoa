CREATE OR REPLACE FUNCTION reject_invoice_snapshot_mutation() RETURNS trigger AS $$
DECLARE issued_local_date DATE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Invoices can only be inserted as DRAFT'; END IF;
  IF NEW."revisesInvoiceId" = NEW."id" THEN RAISE EXCEPTION 'Invoice cannot revise itself'; END IF;
  IF NEW."revisesInvoiceId" IS NULL AND NEW."revisionReason" IS NOT NULL THEN RAISE EXCEPTION 'Normal invoice cannot have a revision reason'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND (NEW."revisionReason" IS NULL OR btrim(NEW."revisionReason") = '') THEN RAISE EXCEPTION 'Invoice revision requires a reason'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Invoice" source
    JOIN "SchoolYear" year ON year."id" = source."schoolYearId" AND year."schoolId" = source."schoolId"
    WHERE source."id" = NEW."revisesInvoiceId" AND source."schoolId" = NEW."schoolId" AND source."status" = 'ISSUED' AND year."closedAt" IS NULL
      AND source."revisesInvoiceId" IS NULL AND source."studentId" = NEW."studentId" AND source."collectionRunId" = NEW."collectionRunId"
      AND source."schoolYearId" = NEW."schoolYearId" AND source."billingMonth" = NEW."billingMonth" AND source."rosterAsOf" = NEW."rosterAsOf"
      AND source."studentCodeSnapshot" = NEW."studentCodeSnapshot" AND source."studentNameSnapshot" = NEW."studentNameSnapshot"
      AND source."enrollmentIdSnapshot" = NEW."enrollmentIdSnapshot" AND source."enrollmentLifecycleSnapshot" = NEW."enrollmentLifecycleSnapshot"
      AND source."enrollmentEffectiveFromSnapshot" = NEW."enrollmentEffectiveFromSnapshot" AND source."enrollmentEndedOnSnapshot" IS NOT DISTINCT FROM NEW."enrollmentEndedOnSnapshot"
      AND source."classAssignmentIdSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentIdSnapshot" AND source."classAssignmentEffectiveFromSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot"
      AND source."classAssignmentEffectiveToSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" AND source."classIdSnapshot" = NEW."classIdSnapshot"
      AND source."classNameSnapshot" = NEW."classNameSnapshot" AND source."selectionProvenance" = NEW."selectionProvenance"
  ) THEN RAISE EXCEPTION 'Invoice revision must copy an issued source from an open school year'; END IF;
  IF TG_OP <> 'INSERT' AND (
    OLD."schoolId" IS DISTINCT FROM NEW."schoolId" OR OLD."studentId" IS DISTINCT FROM NEW."studentId" OR OLD."collectionRunId" IS DISTINCT FROM NEW."collectionRunId" OR OLD."schoolYearId" IS DISTINCT FROM NEW."schoolYearId" OR OLD."billingMonth" IS DISTINCT FROM NEW."billingMonth" OR OLD."rosterAsOf" IS DISTINCT FROM NEW."rosterAsOf" OR OLD."studentCodeSnapshot" IS DISTINCT FROM NEW."studentCodeSnapshot" OR OLD."studentNameSnapshot" IS DISTINCT FROM NEW."studentNameSnapshot" OR OLD."enrollmentIdSnapshot" IS DISTINCT FROM NEW."enrollmentIdSnapshot" OR OLD."enrollmentLifecycleSnapshot" IS DISTINCT FROM NEW."enrollmentLifecycleSnapshot" OR OLD."enrollmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."enrollmentEffectiveFromSnapshot" OR OLD."enrollmentEndedOnSnapshot" IS DISTINCT FROM NEW."enrollmentEndedOnSnapshot" OR OLD."classAssignmentIdSnapshot" IS DISTINCT FROM NEW."classAssignmentIdSnapshot" OR OLD."classAssignmentEffectiveFromSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot" OR OLD."classAssignmentEffectiveToSnapshot" IS DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" OR OLD."classIdSnapshot" IS DISTINCT FROM NEW."classIdSnapshot" OR OLD."classNameSnapshot" IS DISTINCT FROM NEW."classNameSnapshot" OR OLD."selectionProvenance" IS DISTINCT FROM NEW."selectionProvenance" OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" OR OLD."revisesInvoiceId" IS DISTINCT FROM NEW."revisesInvoiceId" OR OLD."revisionReason" IS DISTINCT FROM NEW."revisionReason"
  ) THEN RAISE EXCEPTION 'Invoice roster snapshots and lineage are immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'CANCELLED' THEN RAISE EXCEPTION 'Cancelled invoice is immutable'; END IF;
  IF NEW."status" = 'CANCELLED' THEN
    IF OLD."status" <> 'ISSUED' OR NEW."revisesInvoiceId" IS NOT NULL OR OLD."total" IS DISTINCT FROM NEW."total" OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" OR OLD."bankAccountIdSnapshot" IS DISTINCT FROM NEW."bankAccountIdSnapshot" OR OLD."receivingBankSnapshot" IS DISTINCT FROM NEW."receivingBankSnapshot" OR OLD."accountNumberSnapshot" IS DISTINCT FROM NEW."accountNumberSnapshot" OR OLD."accountHolderNameSnapshot" IS DISTINCT FROM NEW."accountHolderNameSnapshot" OR OLD."transferContentSnapshot" IS DISTINCT FROM NEW."transferContentSnapshot" OR OLD."obligationLinesSnapshot" IS DISTINCT FROM NEW."obligationLinesSnapshot" OR OLD."obligationTotalSnapshot" IS DISTINCT FROM NEW."obligationTotalSnapshot" OR OLD."financePolicyEffectiveFrom" IS DISTINCT FROM NEW."financePolicyEffectiveFrom" OR OLD."dueDaysAfterIssueSnapshot" IS DISTINCT FROM NEW."dueDaysAfterIssueSnapshot" OR OLD."taxTreatmentSnapshot" IS DISTINCT FROM NEW."taxTreatmentSnapshot" OR OLD."debtScopeSnapshot" IS DISTINCT FROM NEW."debtScopeSnapshot" OR OLD."reversalModeSnapshot" IS DISTINCT FROM NEW."reversalModeSnapshot" OR OLD."dueOn" IS DISTINCT FROM NEW."dueOn" THEN RAISE EXCEPTION 'Cancellation can only change invoice status'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  IF NEW."status" = 'DRAFT' THEN
    IF NEW."issuedAt" IS NOT NULL OR NEW."bankAccountIdSnapshot" IS NOT NULL OR NEW."receivingBankSnapshot" IS NOT NULL OR NEW."accountNumberSnapshot" IS NOT NULL OR NEW."accountHolderNameSnapshot" IS NOT NULL OR NEW."transferContentSnapshot" IS NOT NULL OR NEW."obligationLinesSnapshot" IS NOT NULL OR NEW."obligationTotalSnapshot" IS NOT NULL OR NEW."financePolicyEffectiveFrom" IS NOT NULL OR NEW."dueDaysAfterIssueSnapshot" IS NOT NULL OR NEW."taxTreatmentSnapshot" IS NOT NULL OR NEW."debtScopeSnapshot" IS NOT NULL OR NEW."reversalModeSnapshot" IS NOT NULL OR NEW."dueOn" IS NOT NULL THEN RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND (OLD."status" <> 'DRAFT' OR NEW."status" <> 'ISSUED') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
  IF NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  issued_local_date := ((NEW."issuedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF NEW."obligationTotalSnapshot" <> NEW."total" OR NEW."dueOn" <> issued_local_date + NEW."dueDaysAfterIssueSnapshot" THEN RAISE EXCEPTION 'Issued invoice snapshots are internally inconsistent'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
