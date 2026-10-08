-- Decision 2026-10-08: a School may hold several SCHOOL accounts; each Class may name a default SCHOOL account
-- next to its default PERSONAL account.
ALTER TABLE "Class" ADD COLUMN "defaultSchoolBankAccountId" UUID;
ALTER TABLE "Class" ADD CONSTRAINT "Class_defaultSchoolBankAccount_fkey" FOREIGN KEY ("schoolId", "defaultSchoolBankAccountId") REFERENCES "BankAccount"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_class_default_bank_account() RETURNS trigger AS $$
BEGIN
  IF NEW."defaultBankAccountId" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."defaultBankAccountId" IS DISTINCT FROM NEW."defaultBankAccountId") AND NOT EXISTS (
    SELECT 1 FROM "BankAccount" WHERE "id" = NEW."defaultBankAccountId" AND "schoolId" = NEW."schoolId" AND "kind" = 'PERSONAL'
  ) THEN RAISE EXCEPTION 'Class default bank account must be a PERSONAL account of the same School'; END IF;
  IF NEW."defaultSchoolBankAccountId" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."defaultSchoolBankAccountId" IS DISTINCT FROM NEW."defaultSchoolBankAccountId") AND NOT EXISTS (
    SELECT 1 FROM "BankAccount" WHERE "id" = NEW."defaultSchoolBankAccountId" AND "schoolId" = NEW."schoolId" AND "kind" = 'SCHOOL'
  ) THEN RAISE EXCEPTION 'Class default School bank account must be a SCHOOL account of the same School'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
