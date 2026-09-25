CREATE TABLE "IssuedPromotionApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "invoiceLineId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "policyId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "targetId" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "discountType" "PromotionDiscountType" NOT NULL,
  "discountValue" BIGINT NOT NULL,
  "priority" INTEGER NOT NULL,
  "stackingMode" "PromotionStackingMode" NOT NULL,
  "appliedDiscount" BIGINT NOT NULL,
  "versionInterval" JSONB NOT NULL,
  "assignmentInterval" JSONB NOT NULL,
  "assignmentReason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssuedPromotionApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IssuedPromotionApplication_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "IssuedPromotionApplication_schoolId_invoiceLineId_ordinal_key" UNIQUE ("schoolId", "invoiceLineId", "ordinal"),
  CONSTRAINT "IssuedPromotionApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IssuedPromotionApplication_schoolId_invoiceId_fkey" FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IssuedPromotionApplication_schoolId_invoiceLineId_fkey" FOREIGN KEY ("schoolId", "invoiceLineId") REFERENCES "InvoiceLine"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IssuedPromotionApplication_values_valid" CHECK (
    "ordinal" >= 0 AND "priority" > 0 AND "discountValue" >= 0 AND "appliedDiscount" >= 0
  )
);

CREATE INDEX "IssuedPromotionApplication_schoolId_invoiceId_idx" ON "IssuedPromotionApplication"("schoolId", "invoiceId");

CREATE OR REPLACE FUNCTION reject_issued_promotion_application_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Issued promotion application is immutable'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "Invoice" i
    JOIN "InvoiceLine" l ON l."schoolId" = i."schoolId" AND l."invoiceId" = i."id"
    WHERE i."schoolId" = NEW."schoolId" AND i."id" = NEW."invoiceId"
      AND l."id" = NEW."invoiceLineId" AND l."invoiceId" = i."id"
      AND i."status" = 'ISSUED'
  ) THEN RAISE EXCEPTION 'Issued promotion application requires its issued same-School invoice line'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issued_promotion_application_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "IssuedPromotionApplication"
FOR EACH ROW EXECUTE FUNCTION reject_issued_promotion_application_mutation();
