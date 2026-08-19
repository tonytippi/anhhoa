CREATE TYPE "InvoicePaymentMethod" AS ENUM ('CASH', 'TRANSFER');

ALTER TABLE "Invoice" ADD COLUMN "paymentMethod" "InvoicePaymentMethod";
ALTER TABLE "Invoice" ADD COLUMN "bankAccountId" UUID;

CREATE INDEX "Invoice_bankAccountId_idx" ON "Invoice"("bankAccountId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
