-- Sprint change 2026-10-12: a School that does not use school years keeps one SchoolYear without an end date.
-- Existing CHECK, exclusion and trigger bounds compare against the end date and stay open when it is NULL.
ALTER TABLE "SchoolYear" ALTER COLUMN "endsOn" DROP NOT NULL;
ALTER TABLE "StudentEnrollment" ALTER COLUMN "schoolYearEndsOn" DROP NOT NULL;
ALTER TABLE "StaffClassAssignment" ALTER COLUMN "schoolYearEndsOn" DROP NOT NULL;
