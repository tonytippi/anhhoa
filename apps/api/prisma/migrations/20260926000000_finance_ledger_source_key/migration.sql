ALTER TABLE "FinanceLedgerEvent" ADD COLUMN "sourceKey" TEXT;
CREATE UNIQUE INDEX "FinanceLedgerEvent_schoolId_type_sourceKey_key" ON "FinanceLedgerEvent"("schoolId", "type", "sourceKey");
