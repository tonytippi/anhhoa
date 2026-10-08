-- Decision 2026-10-08 (extracurricular-only-students).

-- An EXTRACURRICULAR_ONLY enrollment never carries an official class.
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_extracurricular_only_without_class"
  CHECK ("lifecycle" <> 'EXTRACURRICULAR_ONLY' OR "classId" IS NULL);

-- Parents of extracurricular-only Students submit leave and the Students are handed over like ENROLLED ones.
CREATE OR REPLACE FUNCTION enforce_leave_day_enrollment() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "LeaveRequest" request
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId" = request."schoolId" AND enrollment."studentId" = request."studentId"
    WHERE request."id" = NEW."leaveRequestId"
      AND request."schoolId" = NEW."schoolId"
      AND enrollment."lifecycle" IN ('ENROLLED', 'EXTRACURRICULAR_ONLY')
      AND enrollment."effectiveFrom" <= NEW."operatingOn"
      AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > NEW."operatingOn")
  ) THEN
    RAISE EXCEPTION 'Leave request day must be inside an ENROLLED or EXTRACURRICULAR_ONLY interval';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_handover_enrollment() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "StudentEnrollment" enrollment
    WHERE enrollment."schoolId" = NEW."schoolId" AND enrollment."studentId" = NEW."studentId"
      AND enrollment."lifecycle" IN ('ENROLLED', 'EXTRACURRICULAR_ONLY') AND enrollment."effectiveFrom" <= NEW."handoverOn"
      AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > NEW."handoverOn")
  ) THEN RAISE EXCEPTION 'Handover must be inside an ENROLLED or EXTRACURRICULAR_ONLY interval'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Invoices of extracurricular-only Students have no class snapshot; a revision copies its source's null class.
ALTER TABLE "Invoice" ALTER COLUMN "classIdSnapshot" DROP NOT NULL, ALTER COLUMN "classNameSnapshot" DROP NOT NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_class_snapshot_pair"
  CHECK (("classIdSnapshot" IS NULL) = ("classNameSnapshot" IS NULL));
CREATE OR REPLACE FUNCTION public.reject_invoice_snapshot_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE issued_local_date DATE;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Invoice deletion is forbidden'; END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Invoices can only be inserted as DRAFT'; END IF;
  IF NEW."revisesInvoiceId" = NEW."id" THEN RAISE EXCEPTION 'Invoice cannot revise itself'; END IF;
  IF NEW."revisesInvoiceId" IS NULL AND NEW."revisionReason" IS NOT NULL THEN RAISE EXCEPTION 'Normal invoice cannot have a revision reason'; END IF;
  IF NEW."revisesInvoiceId" IS NOT NULL AND (NEW."revisionReason" IS NULL OR btrim(NEW."revisionReason") = '') THEN RAISE EXCEPTION 'Invoice revision requires a reason'; END IF;
  IF TG_OP = 'INSERT' AND NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Invoice" source WHERE source."id" = NEW."revisesInvoiceId" AND source."schoolId" = NEW."schoolId" AND source."status" IN ('ISSUED', 'CLOSED') AND source."revisesInvoiceId" IS NULL AND source."studentId" = NEW."studentId" AND source."collectionRunId" = NEW."collectionRunId" AND source."schoolYearId" = NEW."schoolYearId" AND source."billingMonth" = NEW."billingMonth" AND source."rosterAsOf" = NEW."rosterAsOf" AND source."studentCodeSnapshot" = NEW."studentCodeSnapshot" AND source."studentNameSnapshot" = NEW."studentNameSnapshot" AND source."enrollmentIdSnapshot" = NEW."enrollmentIdSnapshot" AND source."enrollmentLifecycleSnapshot" = NEW."enrollmentLifecycleSnapshot" AND source."enrollmentEffectiveFromSnapshot" = NEW."enrollmentEffectiveFromSnapshot" AND source."enrollmentEndedOnSnapshot" IS NOT DISTINCT FROM NEW."enrollmentEndedOnSnapshot" AND source."classAssignmentIdSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentIdSnapshot" AND source."classAssignmentEffectiveFromSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveFromSnapshot" AND source."classAssignmentEffectiveToSnapshot" IS NOT DISTINCT FROM NEW."classAssignmentEffectiveToSnapshot" AND source."classIdSnapshot" IS NOT DISTINCT FROM NEW."classIdSnapshot" AND source."classNameSnapshot" IS NOT DISTINCT FROM NEW."classNameSnapshot" AND source."selectionProvenance" = NEW."selectionProvenance") THEN RAISE EXCEPTION 'Invoice revision must copy an issued or closed source roster snapshot and provenance'; END IF;
  IF TG_OP <> 'INSERT' AND (OLD."schoolId", OLD."studentId", OLD."collectionRunId", OLD."schoolYearId", OLD."billingMonth", OLD."rosterAsOf", OLD."studentCodeSnapshot", OLD."studentNameSnapshot", OLD."enrollmentIdSnapshot", OLD."enrollmentLifecycleSnapshot", OLD."enrollmentEffectiveFromSnapshot", OLD."enrollmentEndedOnSnapshot", OLD."classAssignmentIdSnapshot", OLD."classAssignmentEffectiveFromSnapshot", OLD."classAssignmentEffectiveToSnapshot", OLD."classIdSnapshot", OLD."classNameSnapshot", OLD."selectionProvenance", OLD."createdAt", OLD."revisesInvoiceId", OLD."revisionReason") IS DISTINCT FROM (NEW."schoolId", NEW."studentId", NEW."collectionRunId", NEW."schoolYearId", NEW."billingMonth", NEW."rosterAsOf", NEW."studentCodeSnapshot", NEW."studentNameSnapshot", NEW."enrollmentIdSnapshot", NEW."enrollmentLifecycleSnapshot", NEW."enrollmentEffectiveFromSnapshot", NEW."enrollmentEndedOnSnapshot", NEW."classAssignmentIdSnapshot", NEW."classAssignmentEffectiveFromSnapshot", NEW."classAssignmentEffectiveToSnapshot", NEW."classIdSnapshot", NEW."classNameSnapshot", NEW."selectionProvenance", NEW."createdAt", NEW."revisesInvoiceId", NEW."revisionReason") THEN RAISE EXCEPTION 'Invoice roster snapshots and lineage are immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'CLOSED' AND NEW."status" = 'CANCELLED' THEN
    IF ROW(OLD."schoolId", OLD."studentId", OLD."collectionRunId", OLD."schoolYearId", OLD."billingMonth", OLD."rosterAsOf", OLD."studentCodeSnapshot", OLD."studentNameSnapshot", OLD."enrollmentIdSnapshot", OLD."enrollmentLifecycleSnapshot", OLD."enrollmentEffectiveFromSnapshot", OLD."enrollmentEndedOnSnapshot", OLD."classAssignmentIdSnapshot", OLD."classAssignmentEffectiveFromSnapshot", OLD."classAssignmentEffectiveToSnapshot", OLD."classIdSnapshot", OLD."classNameSnapshot", OLD."selectionProvenance", OLD."total", OLD."issuedAt", OLD."bankAccountIdSnapshot", OLD."receivingBankSnapshot", OLD."accountNumberSnapshot", OLD."accountHolderNameSnapshot", OLD."transferContentSnapshot", OLD."obligationLinesSnapshot", OLD."obligationTotalSnapshot", OLD."financePolicyEffectiveFrom", OLD."dueDaysAfterIssueSnapshot", OLD."taxTreatmentSnapshot", OLD."debtScopeSnapshot", OLD."reversalModeSnapshot", OLD."dueOn", OLD."revisesInvoiceId", OLD."revisionReason", OLD."createdAt") IS DISTINCT FROM ROW(NEW."schoolId", NEW."studentId", NEW."collectionRunId", NEW."schoolYearId", NEW."billingMonth", NEW."rosterAsOf", NEW."studentCodeSnapshot", NEW."studentNameSnapshot", NEW."enrollmentIdSnapshot", NEW."enrollmentLifecycleSnapshot", NEW."enrollmentEffectiveFromSnapshot", NEW."enrollmentEndedOnSnapshot", NEW."classAssignmentIdSnapshot", NEW."classAssignmentEffectiveFromSnapshot", NEW."classAssignmentEffectiveToSnapshot", NEW."classIdSnapshot", NEW."classNameSnapshot", NEW."selectionProvenance", NEW."total", NEW."issuedAt", NEW."bankAccountIdSnapshot", NEW."receivingBankSnapshot", NEW."accountNumberSnapshot", NEW."accountHolderNameSnapshot", NEW."transferContentSnapshot", NEW."obligationLinesSnapshot", NEW."obligationTotalSnapshot", NEW."financePolicyEffectiveFrom", NEW."dueDaysAfterIssueSnapshot", NEW."taxTreatmentSnapshot", NEW."debtScopeSnapshot", NEW."reversalModeSnapshot", NEW."dueOn", NEW."revisesInvoiceId", NEW."revisionReason", NEW."createdAt") THEN RAISE EXCEPTION 'Closed correction cancellation can only change status'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" IN ('CLOSED', 'CANCELLED') THEN RAISE EXCEPTION 'Terminal invoice is immutable'; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' AND NEW."status" = 'CLOSED' THEN RETURN NEW; END IF;
  IF NEW."status" = 'CANCELLED' THEN IF OLD."status" <> 'ISSUED' OR NEW."revisesInvoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Cancellation requires a source invoice'; END IF; RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND OLD."status" = 'ISSUED' THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
  IF NEW."status" = 'DRAFT' THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND (OLD."status" <> 'DRAFT' OR NEW."status" <> 'ISSUED') THEN RAISE EXCEPTION 'Invalid invoice lifecycle transition'; END IF;
  IF NEW."issuedAt" IS NULL OR NEW."bankAccountIdSnapshot" IS NULL OR NEW."receivingBankSnapshot" IS NULL OR NEW."accountNumberSnapshot" IS NULL OR NEW."accountHolderNameSnapshot" IS NULL OR NEW."transferContentSnapshot" IS NULL OR NEW."obligationLinesSnapshot" IS NULL OR NEW."obligationTotalSnapshot" IS NULL OR NEW."financePolicyEffectiveFrom" IS NULL OR NEW."dueDaysAfterIssueSnapshot" IS NULL OR NEW."taxTreatmentSnapshot" IS NULL OR NEW."debtScopeSnapshot" IS NULL OR NEW."reversalModeSnapshot" IS NULL OR NEW."dueOn" IS NULL THEN RAISE EXCEPTION 'Issued invoice requires complete immutable snapshots'; END IF;
  issued_local_date := (NEW."issuedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF NEW."obligationTotalSnapshot" <> NEW."total" OR NEW."dueOn" <> issued_local_date + NEW."dueDaysAfterIssueSnapshot" THEN RAISE EXCEPTION 'Issued invoice snapshots are internally inconsistent'; END IF;
  RETURN NEW;
END;
$function$;

-- `Điểm danh riêng`: stored and shown only; the class may change it like its name and Receivable.
ALTER TABLE "ExtracurricularClass" ADD COLUMN "separateAttendance" BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION reject_extracurricular_class_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'name' - 'receivableId' - 'separateAttendance') = (to_jsonb(NEW) - 'name' - 'receivableId' - 'separateAttendance') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Extracurricular class history is append-only; only the name, Receivable and separate attendance may change';
END;
$$;
