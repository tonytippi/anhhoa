-- "Chuyển tất cả công nợ" posts one DebtTransfer per source invoice under a single Operation.
ALTER TABLE "DebtTransfer" DROP CONSTRAINT "DebtTransfer_operationId_key";
CREATE INDEX "DebtTransfer_schoolId_operationId_idx" ON "DebtTransfer"("schoolId", "operationId");
