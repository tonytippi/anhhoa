-- Same as 20261007000001_receivable_auto_leave_deduction, plus classScoped among the editable columns.
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice' - 'autoLeaveDeduction' - 'classScoped' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice' - 'autoLeaveDeduction' - 'classScoped' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') THEN
    IF NEW."groupId" <> OLD."groupId" AND (
      EXISTS (SELECT 1 FROM "InvoiceLine" l WHERE l."schoolId" = OLD."schoolId" AND l."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "CollectionRunTemplateLine" t WHERE t."schoolId" = OLD."schoolId" AND t."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "ExtracurricularClass" c WHERE c."schoolId" = OLD."schoolId" AND c."receivableId" = OLD."id")
    ) THEN
      RAISE EXCEPTION 'Receivable kind cannot change once the Receivable is used on an Invoice, collection template or extracurricular class';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;
