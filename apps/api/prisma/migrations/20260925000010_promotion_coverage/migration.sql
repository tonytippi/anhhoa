CREATE TYPE "PromotionFulfillmentMode" AS ENUM ('DISCOUNT', 'PREPAID_COVERAGE');
ALTER TABLE "PromotionPolicyVersion" ADD COLUMN "fulfillmentMode" "PromotionFulfillmentMode" NOT NULL DEFAULT 'DISCOUNT';

CREATE TABLE "CollectionRunCoverageSelection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "collectionRunId" uuid NOT NULL,
  "studentId" uuid NOT NULL, "versionId" uuid NOT NULL, "billingMonth" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "collectionRunId", "studentId", "versionId", "billingMonth"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "collectionRunId") REFERENCES "CollectionRun"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "versionId") REFERENCES "PromotionPolicyVersion"("schoolId", "id") ON DELETE RESTRICT
);

CREATE TABLE "InvoicePromotionCoverageFact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "invoiceId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "receivableId" uuid NOT NULL, "billingMonth" text NOT NULL, "policyId" uuid NOT NULL,
  "versionId" uuid NOT NULL, "targetId" uuid NOT NULL, "assignmentId" uuid NOT NULL, "originalPrice" bigint NOT NULL,
  "reduction" bigint NOT NULL, "serviceStart" date NOT NULL, "serviceEnd" date NOT NULL, "calendarEffectiveFrom" date NOT NULL,
  "timezone" text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "invoiceId", "receivableId", "billingMonth"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "invoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT,
  CHECK ("originalPrice" >= 0 AND "reduction" >= 0 AND "reduction" <= "originalPrice" AND "serviceEnd" > "serviceStart" AND "timezone" = 'Asia/Ho_Chi_Minh')
);
CREATE INDEX "InvoicePromotionCoverageFact_scope_idx" ON "InvoicePromotionCoverageFact" ("schoolId", "studentId", "schoolYearId", "receivableId", "billingMonth");

CREATE TABLE "StudentPromotionalCoverage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL, "schoolYearId" uuid NOT NULL,
  "receivableId" uuid NOT NULL, "billingMonth" text NOT NULL, "sourceFactId" uuid NOT NULL, "sourceInvoiceId" uuid NOT NULL,
  "sourceReceiptId" uuid NOT NULL, "policyId" uuid NOT NULL, "versionId" uuid NOT NULL, "originalPrice" bigint NOT NULL,
  "reduction" bigint NOT NULL, "serviceStart" date NOT NULL, "serviceEnd" date NOT NULL, "calendarEffectiveFrom" date NOT NULL,
  "timezone" text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', "issuedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "sourceFactId"), UNIQUE ("schoolId", "studentId", "schoolYearId", "receivableId", "billingMonth"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "receivableId") REFERENCES "Receivable"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceFactId") REFERENCES "InvoicePromotionCoverageFact"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceReceiptId") REFERENCES "Receipt"("schoolId", "id") ON DELETE RESTRICT,
  CHECK ("originalPrice" >= 0 AND "reduction" >= 0 AND "reduction" <= "originalPrice" AND "serviceEnd" > "serviceStart" AND "timezone" = 'Asia/Ho_Chi_Minh')
);
CREATE INDEX "StudentPromotionalCoverage_scope_idx" ON "StudentPromotionalCoverage" ("schoolId", "studentId", "schoolYearId", "receivableId", "billingMonth");

CREATE OR REPLACE FUNCTION reject_coverage_selection_after_draft() RETURNS trigger AS $$
DECLARE run_status "CollectionRunStatus";
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT "status" INTO run_status FROM "CollectionRun" WHERE "id" = COALESCE(NEW."collectionRunId", OLD."collectionRunId") AND "schoolId" = COALESCE(NEW."schoolId", OLD."schoolId");
  IF run_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Coverage selection can only change while CollectionRun is DRAFT'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER collection_run_coverage_selection_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "CollectionRunCoverageSelection" FOR EACH ROW EXECUTE FUNCTION reject_coverage_selection_after_draft();

CREATE OR REPLACE FUNCTION reject_coverage_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Promotion coverage is append-only'; END IF;
  IF TG_TABLE_NAME = 'InvoicePromotionCoverageFact' AND NOT EXISTS (
    SELECT 1 FROM "Invoice" invoice
    JOIN "PromotionPolicyVersion" version ON version."id" = NEW."versionId" AND version."schoolId" = NEW."schoolId" AND version."policyId" = NEW."policyId" AND version."fulfillmentMode" = 'PREPAID_COVERAGE'
    JOIN "PromotionPolicyTarget" target ON target."id" = NEW."targetId" AND target."schoolId" = NEW."schoolId" AND target."versionId" = version."id" AND target."receivableId" = NEW."receivableId"
    JOIN "StudentPromotionAssignment" assignment ON assignment."id" = NEW."assignmentId" AND assignment."schoolId" = NEW."schoolId" AND assignment."versionId" = version."id" AND assignment."policyId" = version."policyId" AND assignment."studentId" = NEW."studentId"
    WHERE invoice."id" = NEW."invoiceId" AND invoice."schoolId" = NEW."schoolId" AND invoice."status" = 'DRAFT'
      AND invoice."studentId" = NEW."studentId" AND invoice."schoolYearId" = NEW."schoolYearId"
      AND assignment."effectiveFrom" <= NEW."serviceStart" AND (assignment."effectiveTo" IS NULL OR assignment."effectiveTo" > NEW."serviceStart")
  ) THEN RAISE EXCEPTION 'Coverage fact requires a same-scope draft Invoice snapshot'; END IF;
  IF TG_TABLE_NAME = 'StudentPromotionalCoverage' AND NOT EXISTS (
    SELECT 1 FROM "InvoicePromotionCoverageFact" fact JOIN "Invoice" invoice ON invoice."id" = fact."invoiceId" AND invoice."schoolId" = fact."schoolId" JOIN "Receipt" receipt ON receipt."id" = NEW."sourceReceiptId" AND receipt."schoolId" = NEW."schoolId"
    WHERE fact."id" = NEW."sourceFactId" AND fact."schoolId" = NEW."schoolId" AND fact."studentId" = NEW."studentId" AND fact."schoolYearId" = NEW."schoolYearId" AND fact."receivableId" = NEW."receivableId" AND fact."billingMonth" = NEW."billingMonth" AND fact."invoiceId" = NEW."sourceInvoiceId" AND fact."policyId" = NEW."policyId" AND fact."versionId" = NEW."versionId" AND fact."originalPrice" = NEW."originalPrice" AND fact."reduction" = NEW."reduction" AND fact."serviceStart" = NEW."serviceStart" AND fact."serviceEnd" = NEW."serviceEnd" AND fact."calendarEffectiveFrom" = NEW."calendarEffectiveFrom" AND fact."timezone" = NEW."timezone" AND invoice."status" = 'CLOSED' AND receipt."invoiceId" = invoice."id" AND receipt."outcome" = 'EXACT'
  ) THEN RAISE EXCEPTION 'Coverage requires an exact closed same-scope paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER invoice_coverage_fact_immutable BEFORE INSERT OR UPDATE OR DELETE ON "InvoicePromotionCoverageFact" FOR EACH ROW EXECUTE FUNCTION reject_coverage_mutation();
CREATE TRIGGER student_promotional_coverage_immutable BEFORE INSERT OR UPDATE OR DELETE ON "StudentPromotionalCoverage" FOR EACH ROW EXECUTE FUNCTION reject_coverage_mutation();
