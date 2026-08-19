ALTER TABLE "Invoice" ADD COLUMN "paymentSnapshotMethod" "InvoicePaymentMethod";
ALTER TABLE "Invoice" ADD COLUMN "paymentSnapshotBankCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paymentSnapshotAccountNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paymentSnapshotAccountHolderName" TEXT;

UPDATE "Invoice"
SET "paymentSnapshotMethod" = 'CASH',
    "paymentSnapshotBankCode" = NULL,
    "paymentSnapshotAccountNumber" = NULL,
    "paymentSnapshotAccountHolderName" = NULL
WHERE "status" = 'PENDING' AND "paymentMethod" = 'CASH';

UPDATE "Invoice" AS invoice
SET "paymentSnapshotMethod" = 'TRANSFER',
    "paymentSnapshotBankCode" = account."bankCode",
    "paymentSnapshotAccountNumber" = account."accountNumber",
    "paymentSnapshotAccountHolderName" = account."accountHolderName"
FROM "BankAccount" AS account
WHERE invoice."status" = 'PENDING'
  AND invoice."paymentMethod" = 'TRANSFER'
  AND invoice."bankAccountId" = account."id";
