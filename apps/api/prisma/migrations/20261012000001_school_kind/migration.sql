-- Sprint change 2026-10-12: every School has an immutable kind; existing Schools are preschools.
CREATE TYPE "SchoolKind" AS ENUM ('PRESCHOOL', 'LANGUAGE_CENTER');
ALTER TABLE "School" ADD COLUMN "kind" "SchoolKind" NOT NULL DEFAULT 'PRESCHOOL';

CREATE OR REPLACE FUNCTION reject_school_kind_change() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind" THEN RAISE EXCEPTION 'School kind is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "School_kind_immutable" BEFORE UPDATE ON "School" FOR EACH ROW EXECUTE FUNCTION reject_school_kind_change();
