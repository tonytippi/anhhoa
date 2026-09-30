-- Decision 2026-09-30 (taxed receivables and two payment channels).
-- Receivables carry a tax category; lines snapshot it with API-calculated VAT; Invoices belong to one
-- payment channel; BankAccounts have a kind; Classes may name a default PERSONAL account.
-- Existing rows default to NOT_DECLARED / PERSONAL, so current behaviour is unchanged.

CREATE TYPE "ReceivableTaxCategory" AS ENUM ('NOT_DECLARED', 'EXEMPT', 'VAT_0', 'VAT_5', 'VAT_8', 'VAT_10');
CREATE TYPE "PaymentChannel" AS ENUM ('SCHOOL', 'PERSONAL');

CREATE FUNCTION receivable_tax_channel(category "ReceivableTaxCategory") RETURNS "PaymentChannel" AS $$
  SELECT CASE WHEN category = 'NOT_DECLARED' THEN 'PERSONAL'::"PaymentChannel" ELSE 'SCHOOL'::"PaymentChannel" END;
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION receivable_tax_rate(category "ReceivableTaxCategory") RETURNS integer AS $$
  SELECT CASE category WHEN 'VAT_0' THEN 0 WHEN 'VAT_5' THEN 5 WHEN 'VAT_8' THEN 8 WHEN 'VAT_10' THEN 10 ELSE NULL END;
$$ LANGUAGE sql IMMUTABLE;

-- Receivable -----------------------------------------------------------------------------------
ALTER TABLE "Receivable" ADD COLUMN "taxCategory" "ReceivableTaxCategory" NOT NULL DEFAULT 'NOT_DECLARED';

-- The catalog stays append-only except for the audited tax category.
CREATE FUNCTION reject_receivable_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory') = (to_jsonb(NEW) - 'taxCategory') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER receivable_append_only ON "Receivable";
CREATE TRIGGER receivable_append_only BEFORE UPDATE OR DELETE ON "Receivable" FOR EACH ROW EXECUTE FUNCTION reject_receivable_mutation();

-- InvoiceLine ----------------------------------------------------------------------------------
ALTER TABLE "InvoiceLine" ADD COLUMN "taxCategorySnapshot" "ReceivableTaxCategory";
ALTER TABLE "InvoiceLine" ADD COLUMN "vatRateSnapshot" INTEGER;
ALTER TABLE "InvoiceLine" ADD COLUMN "vatAmount" BIGINT NOT NULL DEFAULT 0;

SELECT set_config('passionedu.allow_history_cleanup', 'on', true);
UPDATE "InvoiceLine" SET "taxCategorySnapshot" = 'NOT_DECLARED' WHERE "kind" = 'NORMAL';
SELECT set_config('passionedu.allow_history_cleanup', 'off', true);

ALTER TABLE "InvoiceLine" DROP CONSTRAINT "InvoiceLine_calculated_amounts";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_calculated_amounts" CHECK (
  "grossAmount" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "grossAmount"
  AND "netAmount" = "grossAmount" - "discountAmount" AND "vatAmount" >= 0 AND "amount" = "netAmount" + "vatAmount"
);
-- NORMAL lines always carry a category; the rate follows it and VAT is half-up on net (integer VND).
-- PRIOR_DEBT lines carry no tax facts: their source obligation already included VAT.
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_vat_snapshot" CHECK (
  ("kind" = 'PRIOR_DEBT' AND "taxCategorySnapshot" IS NULL AND "vatRateSnapshot" IS NULL AND "vatAmount" = 0)
  OR ("kind" = 'NORMAL' AND "taxCategorySnapshot" IS NOT NULL
    AND "vatRateSnapshot" IS NOT DISTINCT FROM receivable_tax_rate("taxCategorySnapshot")
    AND "vatAmount" = COALESCE(floor(("netAmount"::numeric * "vatRateSnapshot" + 50) / 100), 0))
);

-- Invoice --------------------------------------------------------------------------------------
ALTER TABLE "Invoice" ADD COLUMN "channel" "PaymentChannel" NOT NULL DEFAULT 'PERSONAL';
DROP INDEX "Invoice_normal_per_student_run_key";
CREATE UNIQUE INDEX "Invoice_normal_per_student_run_key" ON "Invoice" ("schoolId", "studentId", "collectionRunId", "channel") WHERE "revisesInvoiceId" IS NULL;
CREATE INDEX "Invoice_schoolId_collectionRunId_studentId_idx" ON "Invoice" ("schoolId", "collectionRunId", "studentId");

-- BankAccount ----------------------------------------------------------------------------------
ALTER TABLE "BankAccount" ADD COLUMN "kind" "PaymentChannel" NOT NULL DEFAULT 'PERSONAL';

-- Channel is fixed at insert, a revision keeps its source channel and an issued Invoice is paid
-- into an account of the same kind.
CREATE FUNCTION enforce_invoice_channel() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD."channel" IS DISTINCT FROM NEW."channel" THEN RAISE EXCEPTION 'Invoice payment channel is immutable'; END IF;
  IF TG_OP = 'INSERT' AND NEW."revisesInvoiceId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Invoice" WHERE "id" = NEW."revisesInvoiceId" AND "schoolId" = NEW."schoolId" AND "channel" = NEW."channel"
  ) THEN RAISE EXCEPTION 'Invoice revision must keep its source payment channel'; END IF;
  IF NEW."bankAccountIdSnapshot" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."bankAccountIdSnapshot" IS DISTINCT FROM NEW."bankAccountIdSnapshot") AND NOT EXISTS (
    SELECT 1 FROM "BankAccount" WHERE "id" = NEW."bankAccountIdSnapshot" AND "schoolId" = NEW."schoolId" AND "kind" = NEW."channel"
  ) THEN RAISE EXCEPTION 'Issued invoice bank account kind must match its payment channel'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_zz_channel_guard BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION enforce_invoice_channel();

-- A NORMAL line belongs to the Invoice of its tax channel.
CREATE FUNCTION enforce_invoice_line_channel() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."kind" = 'NORMAL' AND NOT EXISTS (
    SELECT 1 FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId" AND "channel" = receivable_tax_channel(NEW."taxCategorySnapshot")
  ) THEN RAISE EXCEPTION 'Invoice line tax category must match the invoice payment channel'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_line_channel_guard BEFORE INSERT OR UPDATE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_channel();

-- Class default PERSONAL account ---------------------------------------------------------------
ALTER TABLE "Class" ADD COLUMN "defaultBankAccountId" UUID;
ALTER TABLE "Class" ADD CONSTRAINT "Class_defaultBankAccount_fkey" FOREIGN KEY ("schoolId", "defaultBankAccountId") REFERENCES "BankAccount"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_class_default_bank_account() RETURNS trigger AS $$
BEGIN
  IF NEW."defaultBankAccountId" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."defaultBankAccountId" IS DISTINCT FROM NEW."defaultBankAccountId") AND NOT EXISTS (
    SELECT 1 FROM "BankAccount" WHERE "id" = NEW."defaultBankAccountId" AND "schoolId" = NEW."schoolId" AND "kind" = 'PERSONAL'
  ) THEN RAISE EXCEPTION 'Class default bank account must be a PERSONAL account of the same School'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER class_default_bank_account_guard BEFORE INSERT OR UPDATE ON "Class" FOR EACH ROW EXECUTE FUNCTION enforce_class_default_bank_account();
