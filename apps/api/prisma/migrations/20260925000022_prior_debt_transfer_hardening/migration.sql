ALTER TABLE "DebtTransfer" ADD CONSTRAINT "DebtTransfer_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION enforce_prior_debt_transfer() RETURNS trigger AS $$
DECLARE source_invoice "Invoice"; target_invoice "Invoice"; target_line "InvoiceLine"; target_run "CollectionRun"; target_year "SchoolYear"; applied bigint;
BEGIN
  SELECT * INTO source_invoice FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."sourceInvoiceId" FOR UPDATE;
  SELECT * INTO target_invoice FROM "Invoice" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."targetInvoiceId";
  SELECT * INTO target_line FROM "InvoiceLine" WHERE "schoolId" = NEW."schoolId" AND "id" = NEW."targetLineId";
  SELECT * INTO target_run FROM "CollectionRun" WHERE "schoolId" = NEW."schoolId" AND "id" = target_invoice."collectionRunId";
  SELECT * INTO target_year FROM "SchoolYear" WHERE "schoolId" = NEW."schoolId" AND "id" = target_invoice."schoolYearId";
  IF source_invoice."id" IS NULL OR target_invoice."id" IS NULL OR target_line."id" IS NULL OR target_run."id" IS NULL OR target_year."id" IS NULL
    OR source_invoice."status" <> 'ISSUED' OR target_invoice."status" <> 'DRAFT' OR target_run."status" = 'CLOSED' OR target_year."closedAt" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "InvoicePromotionCoverageFact" WHERE "schoolId" = NEW."schoolId" AND "invoiceId" = NEW."sourceInvoiceId")
    OR source_invoice."studentId" <> NEW."studentId" OR target_invoice."studentId" <> NEW."studentId" OR source_invoice."schoolYearId" <> NEW."schoolYearId" OR target_invoice."schoolYearId" <> NEW."schoolYearId"
    OR target_line."invoiceId" <> NEW."targetInvoiceId" OR target_line."kind" <> 'PRIOR_DEBT' OR target_line."receivableId" IS NOT NULL OR target_line."amount" <> NEW."amount" OR btrim(NEW."reason") = '' THEN RAISE EXCEPTION 'Prior debt transfer must link an open same-scope source to an open draft PRIOR_DEBT target line'; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO applied FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND "sourceInvoiceId" = NEW."sourceInvoiceId";
  IF NEW."amount" > source_invoice."obligationTotalSnapshot" - applied THEN RAISE EXCEPTION 'Prior debt transfer exceeds source outstanding'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_prior_debt_line_immutable() RETURNS trigger AS $$
DECLARE transfer "DebtTransfer";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF OLD."kind" <> 'PRIOR_DEBT' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT * INTO transfer FROM "DebtTransfer" WHERE "schoolId" = OLD."schoolId" AND "targetLineId" = OLD."id";
  IF transfer."id" IS NULL OR transfer."targetInvoiceId" <> OLD."invoiceId" OR transfer."amount" <> OLD."amount" THEN RAISE EXCEPTION 'PRIOR_DEBT line provenance is invalid'; END IF;
  RAISE EXCEPTION 'PRIOR_DEBT lines are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER prior_debt_line_no_update_delete BEFORE UPDATE OR DELETE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION enforce_prior_debt_line_immutable();

CREATE OR REPLACE FUNCTION enforce_debt_transfer_invoice_revision_block() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF OLD."status" <> NEW."status" AND NEW."status" = 'CANCELLED' AND EXISTS (SELECT 1 FROM "DebtTransfer" WHERE "schoolId" = NEW."schoolId" AND ("sourceInvoiceId" = NEW."id" OR "targetInvoiceId" = NEW."id")) THEN RAISE EXCEPTION 'Invoices with debt transfers cannot be cancelled for revision'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER debt_transfer_invoice_revision_block BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION enforce_debt_transfer_invoice_revision_block();
