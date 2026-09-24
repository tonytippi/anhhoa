ALTER TABLE "DailyJournalVersion" ADD COLUMN IF NOT EXISTS "policyEffectiveFrom" DATE;
ALTER TABLE "DailyJournalVersion" DISABLE TRIGGER daily_journal_version_append_only;
UPDATE "DailyJournalVersion" AS version SET "policyEffectiveFrom" = journal."policyEffectiveFrom" FROM "DailyJournal" AS journal WHERE journal."id" = version."dailyJournalId" AND journal."schoolId" = version."schoolId";
ALTER TABLE "DailyJournalVersion" ENABLE TRIGGER daily_journal_version_append_only;
ALTER TABLE "DailyJournalVersion" ALTER COLUMN "policyEffectiveFrom" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyJournalVersion_policy_fkey') THEN
    ALTER TABLE "DailyJournalVersion" ADD CONSTRAINT "DailyJournalVersion_policy_fkey" FOREIGN KEY ("schoolId", "policyEffectiveFrom") REFERENCES "DailyJournalPolicy"("schoolId", "effectiveFrom") ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE "DailyJournalMedia" ADD COLUMN IF NOT EXISTS "attachedDailyJournalId" UUID;
CREATE INDEX IF NOT EXISTS "DailyJournalMedia_attachment_idx" ON "DailyJournalMedia"("schoolId", "attachedDailyJournalId");

CREATE OR REPLACE FUNCTION reject_daily_journal_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('passionedu.allow_daily_journal_history_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'daily journal version history is append-only';
END;
$$;
