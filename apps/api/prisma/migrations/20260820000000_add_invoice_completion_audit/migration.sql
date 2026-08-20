ALTER TABLE "Invoice" ADD COLUMN "confirmerId" UUID;
ALTER TABLE "Invoice" ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_confirmerId_fkey"
  FOREIGN KEY ("confirmerId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Invoice_confirmerId_idx" ON "Invoice"("confirmerId");
