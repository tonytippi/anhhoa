ALTER TABLE "InvoiceTemplateItem" DROP CONSTRAINT "InvoiceTemplateItem_fixed_amount_non_negative";
ALTER TABLE "InvoiceTemplateItem" DROP CONSTRAINT "InvoiceTemplateItem_fixed_amount_json_safe";
ALTER TABLE "InvoiceTemplateItem" ADD CONSTRAINT "InvoiceTemplateItem_fixed_amount_json_safe" CHECK ("fixedAmount" IS NULL OR ("fixedAmount" >= -9007199254740991 AND "fixedAmount" <= 9007199254740991));
