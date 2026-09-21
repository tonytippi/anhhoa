ALTER TABLE "Invoice" ADD COLUMN "total" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "InvoiceLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "receivableId" UUID NOT NULL,
  "receivableCodeSnapshot" TEXT,
  "receivableNameSnapshot" TEXT NOT NULL,
  "unitLabelSnapshot" TEXT NOT NULL,
  "defaultUnitPriceSnapshot" BIGINT NOT NULL,
  "unitPrice" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" BIGINT NOT NULL,
  "overrideReason" TEXT,
  "source" JSONB,
  "sourceReason" TEXT,
  "sourceActorIdentityId" UUID,
  "sourceMembershipId" UUID,
  "sourceRecordedAt" TIMESTAMP(3),
  "sourceProvenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceLine_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "InvoiceLine_prices_positive" CHECK ("defaultUnitPriceSnapshot" > 0 AND "unitPrice" > 0),
  CONSTRAINT "InvoiceLine_amount_matches" CHECK ("amount" = "unitPrice" * "quantity"),
  CONSTRAINT "InvoiceLine_source_audit" CHECK (
    "source" IS NULL OR ("sourceReason" IS NOT NULL AND "sourceActorIdentityId" IS NOT NULL AND "sourceMembershipId" IS NOT NULL AND "sourceRecordedAt" IS NOT NULL AND "sourceProvenance" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "InvoiceLine_schoolId_id_key" ON "InvoiceLine"("schoolId", "id");
CREATE INDEX "InvoiceLine_schoolId_invoiceId_idx" ON "InvoiceLine"("schoolId", "invoiceId");
CREATE INDEX "InvoiceLine_schoolId_receivableId_idx" ON "InvoiceLine"("schoolId", "receivableId");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_schoolId_invoiceId_fkey" FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_schoolId_receivableId_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_invoice_line_after_issue() RETURNS trigger AS $$
DECLARE invoice_status "InvoiceStatus";
BEGIN
  SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id" = COALESCE(NEW."invoiceId", OLD."invoiceId") AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId");
  IF invoice_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines can only change while DRAFT'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_line_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION reject_invoice_line_after_issue();

CREATE OR REPLACE FUNCTION recalculate_invoice_total() RETURNS trigger AS $$
DECLARE target_invoice_id uuid;
DECLARE target_school_id uuid;
BEGIN
  target_invoice_id := COALESCE(NEW."invoiceId", OLD."invoiceId");
  target_school_id := COALESCE(NEW."schoolId", OLD."schoolId");
  UPDATE "Invoice"
  SET "total" = COALESCE((SELECT SUM("amount") FROM "InvoiceLine" WHERE "schoolId" = target_school_id AND "invoiceId" = target_invoice_id), 0)
  WHERE "schoolId" = target_school_id AND "id" = target_invoice_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_line_total_authoritative
  AFTER INSERT OR UPDATE OR DELETE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_total();
