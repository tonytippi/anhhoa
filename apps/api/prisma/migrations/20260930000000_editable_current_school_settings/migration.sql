-- School settings stay immutable before the School business date, but versions effective today or
-- later may be corrected or removed (audited by the API). See
-- sprint-change-proposal-2026-09-30-editable-school-settings.md.
ALTER TABLE "SchoolProfileVersion" ADD COLUMN "supportEmail" TEXT;
ALTER TABLE "SchoolProfileVersion" ADD CONSTRAINT "SchoolProfileVersion_supportEmail_length" CHECK ("supportEmail" IS NULL OR length("supportEmail") <= 254);

CREATE FUNCTION guard_school_settings_version_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF OLD."effectiveFrom" < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'School settings history before the business date is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW."id" <> OLD."id" OR NEW."schoolId" <> OLD."schoolId" OR NEW."effectiveFrom" <> OLD."effectiveFrom" THEN
    RAISE EXCEPTION 'School settings version identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION school_calendar_version_referenced(target_school uuid, target_date date) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "LeaveRequestDay" WHERE "schoolId" = target_school AND "calendarEffectiveFrom" = target_date)
      OR EXISTS (SELECT 1 FROM "InvoicePromotionCoverageFact" WHERE "schoolId" = target_school AND "calendarEffectiveFrom" = target_date)
      OR EXISTS (SELECT 1 FROM "StudentPromotionalCoverage" WHERE "schoolId" = target_school AND "calendarEffectiveFrom" = target_date);
$$ LANGUAGE sql STABLE;

CREATE FUNCTION guard_school_calendar_holiday_mutation() RETURNS trigger AS $$
DECLARE
  target "SchoolCalendarHoliday";
  version_date date;
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN target := NEW; ELSE target := OLD; END IF;
  SELECT "effectiveFrom" INTO version_date FROM "SchoolCalendarVersion" WHERE "schoolId" = target."schoolId" AND "id" = target."calendarVersionId";
  IF school_calendar_version_referenced(target."schoolId", version_date) THEN
    RAISE EXCEPTION 'Referenced School calendar version is immutable';
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF version_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'School settings history before the business date is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW."id" <> OLD."id" OR NEW."schoolId" <> OLD."schoolId" OR NEW."calendarVersionId" <> OLD."calendarVersionId" THEN
    RAISE EXCEPTION 'School calendar holiday identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER school_profile_version_append_only ON "SchoolProfileVersion";
DROP TRIGGER school_calendar_version_append_only ON "SchoolCalendarVersion";
DROP TRIGGER school_calendar_holiday_append_only ON "SchoolCalendarHoliday";
DROP TRIGGER finance_policy_append_only ON "FinancePolicy";
DROP TRIGGER attendance_policy_append_only ON "AttendancePolicy";
DROP TRIGGER handover_policy_append_only ON "HandoverPolicy";
DROP TRIGGER daily_journal_policy_append_only ON "DailyJournalPolicy";

CREATE TRIGGER school_profile_version_history_guard BEFORE UPDATE OR DELETE ON "SchoolProfileVersion" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
CREATE TRIGGER school_calendar_version_history_guard BEFORE UPDATE OR DELETE ON "SchoolCalendarVersion" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
CREATE TRIGGER school_calendar_holiday_history_guard BEFORE INSERT OR UPDATE OR DELETE ON "SchoolCalendarHoliday" FOR EACH ROW EXECUTE FUNCTION guard_school_calendar_holiday_mutation();
CREATE TRIGGER finance_policy_history_guard BEFORE UPDATE OR DELETE ON "FinancePolicy" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
CREATE TRIGGER attendance_policy_history_guard BEFORE UPDATE OR DELETE ON "AttendancePolicy" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
CREATE TRIGGER handover_policy_history_guard BEFORE UPDATE OR DELETE ON "HandoverPolicy" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
CREATE TRIGGER daily_journal_policy_history_guard BEFORE UPDATE OR DELETE ON "DailyJournalPolicy" FOR EACH ROW EXECUTE FUNCTION guard_school_settings_version_mutation();
