ALTER TABLE "SchoolYear" ADD CONSTRAINT "SchoolYear_closedByMembership_fkey"
  FOREIGN KEY ("schoolId", "closedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT;


CREATE OR REPLACE FUNCTION enforce_enrollment_class_assignment_bounds() RETURNS trigger AS $$
DECLARE enrollment_row "StudentEnrollment";
DECLARE year_row "SchoolYear";
BEGIN
  SELECT * INTO enrollment_row FROM "StudentEnrollment" WHERE "id" = NEW."enrollmentId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO year_row FROM "SchoolYear" WHERE "id" = NEW."schoolYearId" AND "schoolId" = NEW."schoolId";
  IF enrollment_row."schoolYearId" <> NEW."schoolYearId" OR NEW."effectiveFrom" < enrollment_row."effectiveFrom" OR (enrollment_row."endedOn" IS NOT NULL AND NEW."effectiveTo" > enrollment_row."endedOn") OR NEW."effectiveFrom" < year_row."startsOn" OR NEW."effectiveFrom" >= year_row."endsOn" OR (NEW."effectiveTo" IS NOT NULL AND NEW."effectiveTo" > year_row."endsOn") THEN
    RAISE EXCEPTION 'EnrollmentClassAssignment bounds invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "EnrollmentClassAssignment_bounds_trigger" BEFORE INSERT OR UPDATE ON "EnrollmentClassAssignment"
  FOR EACH ROW EXECUTE FUNCTION enforce_enrollment_class_assignment_bounds();
