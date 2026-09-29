-- Every receiving BankAccount carries its NAPAS VietQR bank BIN, and issue snapshots keep it.
-- BankAccount is append-only, so rows created before this decision cannot be backfilled;
-- PassionEdu has no operational data yet, so such databases must be reset.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BankAccount") THEN
    RAISE EXCEPTION 'BankAccount rows without VietQR BIN exist; reset this pre-production database before applying 20260929000000_vietqr_bank_bin';
  END IF;
END $$;

ALTER TABLE "BankAccount" ADD COLUMN "bankBin" TEXT NOT NULL;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_bankBin_format" CHECK ("bankBin" ~ '^[0-9]{6}$');
ALTER TABLE "Invoice" ADD COLUMN "receivingBankBinSnapshot" TEXT;

CREATE OR REPLACE FUNCTION enforce_invoice_bank_bin_snapshot() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW."status" = 'DRAFT' THEN
    IF NEW."receivingBankBinSnapshot" IS NOT NULL THEN
      RAISE EXCEPTION 'Draft invoice cannot contain issue snapshots';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" <> 'DRAFT' THEN
    IF OLD."receivingBankBinSnapshot" IS DISTINCT FROM NEW."receivingBankBinSnapshot" THEN
      RAISE EXCEPTION 'Invoice bank BIN snapshot is immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."receivingBankBinSnapshot" IS NULL OR NEW."receivingBankBinSnapshot" IS DISTINCT FROM (
    SELECT "bankBin" FROM "BankAccount" WHERE "id" = NEW."bankAccountIdSnapshot" AND "schoolId" = NEW."schoolId"
  ) THEN
    RAISE EXCEPTION 'Issued invoice requires the bank BIN of its BankAccount snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Named to fire after the existing snapshot guards (PostgreSQL orders triggers by name), so their errors stay first.
CREATE TRIGGER invoice_vietqr_bin_snapshot_guard BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION enforce_invoice_bank_bin_snapshot();
