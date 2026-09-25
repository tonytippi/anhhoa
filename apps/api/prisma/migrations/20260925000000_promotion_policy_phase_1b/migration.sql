CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE "PromotionPolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "PromotionDiscountType" AS ENUM ('FIXED_VND', 'PERCENTAGE');
CREATE TYPE "PromotionStackingMode" AS ENUM ('STACKABLE', 'EXCLUSIVE');

CREATE TABLE "PromotionPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionPolicy_pkey" PRIMARY KEY ("id"), CONSTRAINT "PromotionPolicy_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "PromotionPolicy_schoolId_name_key" UNIQUE ("schoolId", "name"),
  CONSTRAINT "PromotionPolicy_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE TABLE "PromotionPolicyVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "policyId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "status" "PromotionPolicyVersionStatus" NOT NULL DEFAULT 'DRAFT', "discountType" "PromotionDiscountType" NOT NULL,
  "discountValue" BIGINT NOT NULL, "priority" INTEGER NOT NULL, "stackingMode" "PromotionStackingMode" NOT NULL,
  "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionPolicyVersion_pkey" PRIMARY KEY ("id"), CONSTRAINT "PromotionPolicyVersion_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "PromotionPolicyVersion_version_key" UNIQUE ("schoolId", "policyId", "version"),
  CONSTRAINT "PromotionPolicyVersion_dates" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo"),
  CONSTRAINT "PromotionPolicyVersion_discount" CHECK ("discountValue" > 0 AND ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100)),
  CONSTRAINT "PromotionPolicyVersion_priority" CHECK ("priority" > 0),
  CONSTRAINT "PromotionPolicyVersion_policy_fkey" FOREIGN KEY ("schoolId", "policyId") REFERENCES "PromotionPolicy"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "PromotionPolicyVersion_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE TABLE "PromotionPolicyTarget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "versionId" UUID NOT NULL, "receivableId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionPolicyTarget_pkey" PRIMARY KEY ("id"), CONSTRAINT "PromotionPolicyTarget_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "PromotionPolicyTarget_unique" UNIQUE ("schoolId", "versionId", "receivableId"),
  CONSTRAINT "PromotionPolicyTarget_version_fkey" FOREIGN KEY ("schoolId", "versionId") REFERENCES "PromotionPolicyVersion"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "PromotionPolicyTarget_receivable_fkey" FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "PromotionPolicyTarget_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE TABLE "StudentPromotionAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "schoolId" UUID NOT NULL, "studentId" UUID NOT NULL, "policyId" UUID NOT NULL, "versionId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE, "reason" TEXT NOT NULL, "endReason" TEXT, "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentPromotionAssignment_pkey" PRIMARY KEY ("id"), CONSTRAINT "StudentPromotionAssignment_schoolId_id_key" UNIQUE ("schoolId", "id"),
  CONSTRAINT "StudentPromotionAssignment_dates" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo"),
  CONSTRAINT "StudentPromotionAssignment_version_fkey" FOREIGN KEY ("schoolId", "versionId") REFERENCES "PromotionPolicyVersion"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentPromotionAssignment_policy_fkey" FOREIGN KEY ("schoolId", "policyId") REFERENCES "PromotionPolicy"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentPromotionAssignment_student_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  CONSTRAINT "StudentPromotionAssignment_school_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT
);
CREATE INDEX "PromotionPolicy_schoolId_createdAt_idx" ON "PromotionPolicy" ("schoolId", "createdAt");
CREATE INDEX "PromotionPolicyVersion_schoolId_policyId_effectiveFrom_idx" ON "PromotionPolicyVersion" ("schoolId", "policyId", "effectiveFrom");
CREATE INDEX "PromotionPolicyTarget_schoolId_receivableId_idx" ON "PromotionPolicyTarget" ("schoolId", "receivableId");
CREATE INDEX "StudentPromotionAssignment_schoolId_studentId_policyId_effectiveFrom_idx" ON "StudentPromotionAssignment" ("schoolId", "studentId", "policyId", "effectiveFrom");
ALTER TABLE "PromotionPolicyVersion" ADD CONSTRAINT "PromotionPolicyVersion_no_active_overlap" EXCLUDE USING gist ("schoolId" WITH =, "policyId" WITH =, daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[)') WITH &&) WHERE ("status" = 'ACTIVE');
ALTER TABLE "StudentPromotionAssignment" ADD CONSTRAINT "StudentPromotionAssignment_no_overlap" EXCLUDE USING gist ("schoolId" WITH =, "studentId" WITH =, "policyId" WITH =, daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[)') WITH &&);
CREATE OR REPLACE FUNCTION reject_promotion_version_immutable() RETURNS trigger AS $$ BEGIN
  IF OLD."status" IN ('ACTIVE', 'RETIRED') AND (OLD."policyId", OLD."discountType", OLD."discountValue", OLD."priority", OLD."stackingMode", OLD."effectiveFrom", OLD."effectiveTo") IS DISTINCT FROM (NEW."policyId", NEW."discountType", NEW."discountValue", NEW."priority", NEW."stackingMode", NEW."effectiveFrom", NEW."effectiveTo") THEN RAISE EXCEPTION 'Promotion policy version configuration is immutable'; END IF;
  IF OLD."status" = 'RETIRED' AND NEW."status" <> 'RETIRED' THEN RAISE EXCEPTION 'Retired promotion policy version cannot transition'; END IF;
  IF OLD."status" = 'DRAFT' AND NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN RAISE EXCEPTION 'Invalid promotion policy version transition'; END IF;
  IF OLD."status" = 'ACTIVE' AND NEW."status" NOT IN ('ACTIVE', 'RETIRED') THEN RAISE EXCEPTION 'Invalid promotion policy version transition'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER promotion_version_immutable BEFORE UPDATE ON "PromotionPolicyVersion" FOR EACH ROW EXECUTE FUNCTION reject_promotion_version_immutable();
CREATE OR REPLACE FUNCTION reject_promotion_target_immutable() RETURNS trigger AS $$ DECLARE version_status "PromotionPolicyVersionStatus"; BEGIN SELECT "status" INTO version_status FROM "PromotionPolicyVersion" WHERE "id" = COALESCE(NEW."versionId", OLD."versionId") AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId"); IF version_status IN ('ACTIVE', 'RETIRED') THEN RAISE EXCEPTION 'Promotion policy targets are immutable'; END IF; RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER promotion_target_immutable BEFORE INSERT OR UPDATE OR DELETE ON "PromotionPolicyTarget" FOR EACH ROW EXECUTE FUNCTION reject_promotion_target_immutable();
