CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE "SchoolProfileVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "schoolName" TEXT NOT NULL, "address" TEXT,
  "phone" TEXT, "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolProfileVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolProfileVersion_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "SchoolProfileVersion_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "SchoolProfileVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SchoolProfileVersion_schoolId_effectiveFrom_idx" ON "SchoolProfileVersion"("schoolId", "effectiveFrom");
CREATE TABLE "SchoolCalendarVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "actorIdentityId" UUID NOT NULL, "membershipId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolCalendarVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolCalendarVersion_schoolId_effectiveFrom_key" UNIQUE ("schoolId", "effectiveFrom"),
  CONSTRAINT "SchoolCalendarVersion_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "SchoolCalendarVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SchoolCalendarVersion_schoolId_effectiveFrom_idx" ON "SchoolCalendarVersion"("schoolId", "effectiveFrom");
CREATE TABLE "SchoolCalendarHoliday" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL,
  "calendarVersionId" UUID NOT NULL, "name" TEXT NOT NULL, "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolCalendarHoliday_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SchoolCalendarHoliday_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "SchoolCalendarHoliday_calendar_graph_fkey" FOREIGN KEY ("schoolId", "calendarVersionId") REFERENCES "SchoolCalendarVersion"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SchoolCalendarHoliday_order_check" CHECK ("startsOn" <= "endsOn")
);
CREATE INDEX "SchoolCalendarHoliday_schoolId_calendarVersionId_startsOn_idx" ON "SchoolCalendarHoliday"("schoolId", "calendarVersionId", "startsOn");
ALTER TABLE "SchoolCalendarHoliday" ADD CONSTRAINT "SchoolCalendarHoliday_no_overlap" EXCLUDE USING gist ("calendarVersionId" WITH =, daterange("startsOn", "endsOn", '[]') WITH &&);

CREATE FUNCTION reject_school_settings_history_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'School settings history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER school_profile_version_append_only BEFORE UPDATE OR DELETE ON "SchoolProfileVersion" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER school_calendar_version_append_only BEFORE UPDATE OR DELETE ON "SchoolCalendarVersion" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
CREATE TRIGGER school_calendar_holiday_append_only BEFORE UPDATE OR DELETE ON "SchoolCalendarHoliday" FOR EACH ROW EXECUTE FUNCTION reject_school_settings_history_mutation();
