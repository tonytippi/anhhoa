CREATE TYPE "FinanceLedgerEventType" AS ENUM (
  'INVOICE_ISSUED', 'INVOICE_CANCELLED', 'RECEIPT_POSTED',
  'SETTLEMENT_DIFFERENCE_POSTED', 'SETTLEMENT_CARRY_POSTED',
  'SETTLEMENT_TRANSFER_POSTED', 'DEBT_TRANSFER_POSTED',
  'COVERAGE_ISSUED', 'COVERAGE_REVERSAL_POSTED'
);

CREATE TABLE "FinanceLedgerEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "type" "FinanceLedgerEventType" NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invoiceId" UUID,
  "collectionRunId" UUID,
  "schoolYearId" UUID,
  "studentId" UUID,
  "billingMonth" TEXT,
  "className" TEXT,
  "groupName" TEXT,
  "statusSnapshot" TEXT,
  "amount" BIGINT NOT NULL DEFAULT 0,
  "grossAmount" BIGINT NOT NULL DEFAULT 0,
  "discountAmount" BIGINT NOT NULL DEFAULT 0,
  "netAmount" BIGINT NOT NULL DEFAULT 0,
  "provenance" JSONB NOT NULL,
  CONSTRAINT "FinanceLedgerEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceLedgerEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceLedgerEvent_schoolId_invoiceId_fkey" FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FinanceLedgerEvent_schoolId_postedAt_idx" ON "FinanceLedgerEvent"("schoolId", "postedAt");
CREATE INDEX "FinanceLedgerEvent_schoolId_billingMonth_collectionRunId_idx" ON "FinanceLedgerEvent"("schoolId", "billingMonth", "collectionRunId");
CREATE INDEX "FinanceLedgerEvent_schoolId_schoolYearId_postedAt_idx" ON "FinanceLedgerEvent"("schoolId", "schoolYearId", "postedAt");

CREATE TABLE "FinanceReportExport" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "workspace" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "csv" BYTEA NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "downloadedAt" TIMESTAMP(3),
  CONSTRAINT "FinanceReportExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceReportExport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceReportExport_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceReportExport_schoolId_id_key" ON "FinanceReportExport"("schoolId", "id");
CREATE INDEX "FinanceReportExport_schoolId_expiresAt_idx" ON "FinanceReportExport"("schoolId", "expiresAt");
