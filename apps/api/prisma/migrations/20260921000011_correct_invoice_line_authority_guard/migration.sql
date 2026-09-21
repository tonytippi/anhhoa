CREATE OR REPLACE FUNCTION reject_invoice_line_after_issue() RETURNS trigger AS $$
DECLARE invoice_status "InvoiceStatus";
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id" = NEW."invoiceId" AND "schoolId" = NEW."schoolId";
    IF invoice_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines can only change while DRAFT'; END IF;
    RETURN NEW;
  END IF;
  SELECT "status" INTO invoice_status FROM "Invoice" WHERE "id" = OLD."invoiceId" AND "schoolId" = OLD."schoolId";
  IF invoice_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Invoice lines can only change while DRAFT'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD."invoiceId" IS DISTINCT FROM NEW."invoiceId" OR OLD."schoolId" IS DISTINCT FROM NEW."schoolId") THEN
    RAISE EXCEPTION 'Invoice line identity is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
