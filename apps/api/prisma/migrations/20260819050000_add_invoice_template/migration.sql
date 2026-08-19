CREATE TYPE "InvoiceTemplateAmountSource" AS ENUM ('FIXED', 'CLASS_TUITION');

CREATE TABLE "InvoiceTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceTemplate_singleton_key" ON "InvoiceTemplate"("singleton");
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_singleton_true" CHECK ("singleton" = true);

CREATE TABLE "InvoiceTemplateItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "feeGroup" TEXT,
    "position" INTEGER NOT NULL,
    "amountSource" "InvoiceTemplateAmountSource" NOT NULL,
    "fixedAmount" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTemplateItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_templateId_position_key" UNIQUE ("templateId", "position") DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX "InvoiceTemplateItem_templateId_position_idx" ON "InvoiceTemplateItem"("templateId", "position");
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_amount_source_consistency" CHECK (("amountSource" = 'FIXED' AND "fixedAmount" IS NOT NULL) OR ("amountSource" = 'CLASS_TUITION' AND "fixedAmount" IS NULL));
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_fixed_amount_non_negative" CHECK ("fixedAmount" IS NULL OR "fixedAmount" >= 0);
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_fixed_amount_json_safe" CHECK ("fixedAmount" IS NULL OR "fixedAmount" <= 9007199254740991);
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_position_non_negative" CHECK ("position" >= 0);
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
