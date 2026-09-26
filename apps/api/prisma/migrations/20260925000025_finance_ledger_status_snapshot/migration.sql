ALTER TABLE "FinanceLedgerEvent"
  ADD COLUMN IF NOT EXISTS "statusSnapshot" TEXT;
