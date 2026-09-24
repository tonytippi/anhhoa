CREATE OR REPLACE FUNCTION reject_daily_journal_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('passionedu.allow_daily_journal_history_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'daily journal version history is append-only';
END;
$$;
