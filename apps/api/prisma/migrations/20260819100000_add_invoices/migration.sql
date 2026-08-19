CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED');

CREATE TABLE "Invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studentId" UUID NOT NULL,
    "billingMonth" DATE NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentNickname" TEXT,
    "classId" UUID NOT NULL,
    "className" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "total" BIGINT NOT NULL DEFAULT 0,
    "creatorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invoice_billingMonth_month_start" CHECK ("billingMonth" = date_trunc('month', "billingMonth")::date)
);

CREATE UNIQUE INDEX "Invoice_studentId_billingMonth_key" ON "Invoice"("studentId", "billingMonth");
CREATE INDEX "Invoice_billingMonth_status_classId_createdAt_id_idx" ON "Invoice"("billingMonth", "status", "classId", "createdAt", "id");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
