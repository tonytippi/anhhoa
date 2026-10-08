-- Decision 2026-10-08 (school-days-for-daily-receivables): the finance policy names the school days of the week
-- (ISO 1 = Monday … 6 = Saturday). A receivable with autoLeaveDeduction opens each run at the number of school
-- days in the month (minus holidays) and only leave days on school days are refunded. Existing policies keep
-- Monday–Saturday, the operating days used so far.
ALTER TABLE "FinancePolicy" ADD COLUMN "schoolWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6];
ALTER TABLE "FinancePolicy" ADD CONSTRAINT "FinancePolicy_schoolWeekdays_valid" CHECK (cardinality("schoolWeekdays") > 0 AND "schoolWeekdays" <@ ARRAY[1, 2, 3, 4, 5, 6]);
