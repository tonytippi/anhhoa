CREATE OR REPLACE FUNCTION enforce_draft_invoice_snapshot_empty() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."status" = 'DRAFT' AND (NEW."issuedAt" IS NOT NULL OR NEW."bankAccountIdSnapshot" IS NOT NULL OR NEW."receivingBankSnapshot" IS NOT NULL OR NEW."accountNumberSnapshot" IS NOT NULL OR NEW."accountHolderNameSnapshot" IS NOT NULL OR NEW."transferContentSnapshot" IS NOT NULL OR NEW."obligationLinesSnapshot" IS NOT NULL OR NEW."obligationTotalSnapshot" IS NOT NULL OR NEW."financePolicyEffectiveFrom" IS NOT NULL OR NEW."dueDaysAfterIssueSnapshot" IS NOT NULL OR NEW."taxTreatmentSnapshot" IS NOT NULL OR NEW."debtScopeSnapshot" IS NOT NULL OR NEW."reversalModeSnapshot" IS NOT NULL OR NEW."dueOn" IS NOT NULL) THEN
    RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER draft_invoice_snapshot_guard BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION enforce_draft_invoice_snapshot_empty();
