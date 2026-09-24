ALTER TABLE "DailyJournal"
  ADD COLUMN "enrollmentIdSnapshot" UUID,
  ADD COLUMN "enrollmentEndedOnSnapshot" DATE;

UPDATE "DailyJournal" AS journal
SET "enrollmentIdSnapshot" = enrollment."id"
FROM "StudentEnrollment" AS enrollment
WHERE enrollment."schoolId" = journal."schoolId"
  AND enrollment."studentId" = journal."studentId"
  AND enrollment."effectiveFrom" <= journal."journalDate"
  AND (enrollment."endedOn" IS NULL OR enrollment."endedOn" > journal."journalDate");

UPDATE "DailyJournal" AS journal
SET "enrollmentEndedOnSnapshot" = (
  SELECT transition."endedOn"
  FROM "StudentEnrollmentLifecycleTransition" AS transition
  WHERE transition."schoolId" = journal."schoolId"
    AND transition."enrollmentId" = journal."enrollmentIdSnapshot"
    AND transition."endedOn" IS NOT NULL
  ORDER BY transition."createdAt" ASC
  LIMIT 1
)
WHERE journal."enrollmentEndedOnSnapshot" IS NULL;

ALTER TABLE "DailyJournal"
  ALTER COLUMN "enrollmentIdSnapshot" SET NOT NULL,
  ADD CONSTRAINT "DailyJournal_enrollment_snapshot_fkey"
    FOREIGN KEY ("schoolId", "enrollmentIdSnapshot") REFERENCES "StudentEnrollment"("schoolId", "id") ON DELETE RESTRICT;

CREATE INDEX "DailyJournal_enrollment_retention_idx"
  ON "DailyJournal"("schoolId", "enrollmentIdSnapshot", "enrollmentEndedOnSnapshot");

CREATE FUNCTION snapshot_daily_journal_enrollment_end() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."endedOn" IS NOT NULL AND (OLD."endedOn" IS NULL OR OLD."endedOn" <> NEW."endedOn") THEN
    UPDATE "DailyJournal"
    SET "enrollmentEndedOnSnapshot" = NEW."endedOn"
    WHERE "schoolId" = NEW."schoolId"
      AND "enrollmentIdSnapshot" = NEW."id"
      AND "enrollmentEndedOnSnapshot" IS NULL
      AND "journalDate" < NEW."endedOn";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_journal_enrollment_end_snapshot
AFTER UPDATE OF "endedOn" ON "StudentEnrollment"
FOR EACH ROW EXECUTE FUNCTION snapshot_daily_journal_enrollment_end();
