-- Decision 2026-10-02 §3.5: Finance edits a Receivable's name, unit label and default unit price directly (audited in the API).
-- Everything else stays append-only; the group/kind lock rule is kept.
CREATE OR REPLACE FUNCTION reject_receivable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'taxCategory' - 'refundUnitPrice' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') = (to_jsonb(NEW) - 'taxCategory' - 'refundUnitPrice' - 'groupId' - 'displayName' - 'unitLabel' - 'defaultUnitPrice') THEN
    IF NEW."groupId" <> OLD."groupId" AND (
      EXISTS (SELECT 1 FROM "InvoiceLine" l WHERE l."schoolId" = OLD."schoolId" AND l."receivableId" = OLD."id")
      OR EXISTS (SELECT 1 FROM "CollectionRunTemplateLine" t WHERE t."schoolId" = OLD."schoolId" AND t."receivableId" = OLD."id")
    ) THEN
      RAISE EXCEPTION 'Receivable kind cannot change once the Receivable is used on an Invoice or collection template';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$;
