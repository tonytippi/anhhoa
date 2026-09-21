ALTER TABLE "InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_source_audit";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_source_audit" CHECK (
  ("source" IS NULL AND "sourceReason" IS NULL AND "sourceActorIdentityId" IS NULL AND "sourceMembershipId" IS NULL AND "sourceRecordedAt" IS NULL AND "sourceProvenance" IS NULL)
  OR
  ("source" IS NOT NULL AND "sourceReason" IS NOT NULL AND "sourceActorIdentityId" IS NOT NULL AND "sourceMembershipId" IS NOT NULL AND "sourceRecordedAt" IS NOT NULL AND "sourceProvenance" IS NOT NULL)
);

CREATE OR REPLACE FUNCTION reject_invoice_total_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD."total" IS DISTINCT FROM NEW."total" AND current_setting('passionedu.recalculate_invoice_total', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Invoice total is derived from InvoiceLine';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS invoice_total_derived_only ON "Invoice";
CREATE TRIGGER invoice_total_derived_only BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION reject_invoice_total_mutation();

CREATE OR REPLACE FUNCTION reject_invoice_line_after_issue() RETURNS trigger AS $$
DECLARE old_status "InvoiceStatus";
DECLARE new_status "InvoiceStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD."invoiceId" IS DISTINCT FROM NEW."invoiceId" OR OLD."schoolId" IS DISTINCT FROM NEW."schoolId") THEN
    RAISE EXCEPTION 'Invoice line identity is immutable';
  END IF;
  SELECT "status" INTO old_status FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "schoolId" = OLD."schoolId";
  IF old_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines can only change while DRAFT'; END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "status" INTO new_status FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
    IF new_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines can only change while DRAFT'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_invoice_total() RETURNS trigger AS $$
DECLARE target_invoice_id uuid;
DECLARE target_school_id uuid;
BEGIN
  target_invoice_id := COALESCE(NEW."invoiceId", OLD."invoiceId");
  target_school_id := COALESCE(NEW."schoolId", OLD."schoolId");
  PERFORM set_config('passionedu.recalculate_invoice_total', 'on', true);
  UPDATE "Invoice"
  SET "total" = COALESCE((SELECT SUM("amount") FROM "InvoiceLine" WHERE "schoolId" = target_school_id AND "invoiceId" = target_invoice_id), 0)
  WHERE "schoolId" = target_school_id AND "id" = target_invoice_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
