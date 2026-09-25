CREATE TYPE "CoverageReversalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REFUSED', 'POSTED');

CREATE TABLE "SettlementTransfer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "studentId" uuid NOT NULL,
  "schoolYearId" uuid NOT NULL, "sourceInvoiceId" uuid NOT NULL, "sourceReceiptId" uuid NOT NULL,
  "replacementInvoiceId" uuid NOT NULL, "amount" bigint NOT NULL CHECK ("amount" >= 0), "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "replacementInvoiceId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "studentId") REFERENCES "Student"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "schoolYearId") REFERENCES "SchoolYear"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "sourceReceiptId") REFERENCES "Receipt"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "replacementInvoiceId") REFERENCES "Invoice"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "SettlementTransfer_schoolId_sourceInvoiceId_idx" ON "SettlementTransfer" ("schoolId", "sourceInvoiceId");

CREATE TABLE "CoverageReversalRequest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "coverageId" uuid NOT NULL,
  "amount" bigint NOT NULL CHECK ("amount" >= 0), "effectiveOn" date NOT NULL, "reason" text NOT NULL,
  "policyMode" "FinanceReversalMode" NOT NULL, "status" "CoverageReversalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByMembershipId" uuid NOT NULL, "decidedByMembershipId" uuid, "decidedAt" timestamptz,
  "refusalReason" text, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("schoolId", "id"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "coverageId") REFERENCES "StudentPromotionalCoverage"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "requestedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "decidedByMembershipId") REFERENCES "SchoolMembership"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CoverageReversalRequest_schoolId_coverageId_status_idx" ON "CoverageReversalRequest" ("schoolId", "coverageId", "status");

CREATE TABLE "CoverageReversal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "coverageId" uuid NOT NULL,
  "requestId" uuid UNIQUE, "amount" bigint NOT NULL CHECK ("amount" >= 0), "effectiveOn" date NOT NULL,
  "reason" text NOT NULL, "postedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("schoolId", "id"), UNIQUE ("schoolId", "requestId"),
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "coverageId") REFERENCES "StudentPromotionalCoverage"("schoolId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("schoolId", "requestId") REFERENCES "CoverageReversalRequest"("schoolId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CoverageReversal_schoolId_coverageId_idx" ON "CoverageReversal" ("schoolId", "coverageId");

CREATE OR REPLACE FUNCTION enforce_settlement_transfer_graph() RETURNS trigger AS $$
DECLARE source_invoice "Invoice"; replacement "Invoice"; source_receipt "Receipt";
BEGIN
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = NEW."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO replacement FROM "Invoice" WHERE "id" = NEW."replacementInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_receipt FROM "Receipt" WHERE "id" = NEW."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF source_invoice."status" <> 'CLOSED' OR replacement."status" <> 'ISSUED' OR replacement."revisesInvoiceId" <> source_invoice."id"
    OR source_receipt."invoiceId" <> source_invoice."id" OR source_receipt."studentId" <> NEW."studentId"
    OR source_receipt."schoolYearId" <> NEW."schoolYearId" OR source_invoice."studentId" <> NEW."studentId"
    OR replacement."studentId" <> NEW."studentId" OR source_invoice."schoolYearId" <> NEW."schoolYearId"
    OR replacement."schoolYearId" <> NEW."schoolYearId" OR NEW."amount" <> source_receipt."actualAmount" THEN
    RAISE EXCEPTION 'Settlement transfer must project one closed same-scope receipt to its issued replacement';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER settlement_transfer_graph_guard BEFORE INSERT ON "SettlementTransfer" FOR EACH ROW EXECUTE FUNCTION enforce_settlement_transfer_graph();

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_request_graph() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; source_invoice "Invoice";
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO source_invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  IF coverage."sourceReceiptId" IS NULL OR source_invoice."status" NOT IN ('CLOSED', 'CANCELLED')
    OR source_invoice."reversalModeSnapshot" <> NEW."policyMode" OR NEW."amount" < 0 THEN
    RAISE EXCEPTION 'Coverage reversal request must use its immutable paid same-School policy snapshot';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD."status" <> 'PENDING' OR NEW."coverageId" <> OLD."coverageId" OR NEW."amount" <> OLD."amount"
    OR NEW."effectiveOn" <> OLD."effectiveOn" OR NEW."reason" <> OLD."reason" OR NEW."policyMode" <> OLD."policyMode"
    OR NEW."requestedByMembershipId" <> OLD."requestedByMembershipId" OR NEW."status" NOT IN ('REFUSED', 'POSTED')
    OR NEW."decidedByMembershipId" IS NULL OR NEW."decidedByMembershipId" = OLD."requestedByMembershipId") THEN
    RAISE EXCEPTION 'Coverage reversal request lifecycle is immutable and requires a distinct decider';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_reversal_request_graph_guard BEFORE INSERT OR UPDATE ON "CoverageReversalRequest" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_request_graph();

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_graph() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; request "CoverageReversalRequest";
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId";
  IF NEW."requestId" IS NOT NULL THEN
    SELECT * INTO request FROM "CoverageReversalRequest" WHERE "id" = NEW."requestId" AND "schoolId" = NEW."schoolId";
    IF request."status" <> 'PENDING' OR request."coverageId" <> NEW."coverageId" OR request."amount" <> NEW."amount"
      OR request."effectiveOn" <> NEW."effectiveOn" OR request."reason" <> NEW."reason" THEN RAISE EXCEPTION 'Coverage reversal must post exactly its pending request'; END IF;
  END IF;
  IF NEW."amount" > coverage."originalPrice" - coverage."reduction" THEN RAISE EXCEPTION 'Coverage reversal exceeds paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_reversal_graph_guard BEFORE INSERT ON "CoverageReversal" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_graph();

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_append_only() RETURNS trigger AS $$
BEGIN
  IF current_setting('passionedu.allow_history_cleanup', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'Coverage reversal provenance is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER coverage_reversal_no_update_delete BEFORE UPDATE OR DELETE ON "CoverageReversal" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_append_only();
CREATE TRIGGER settlement_transfer_no_update_delete BEFORE UPDATE OR DELETE ON "SettlementTransfer" FOR EACH ROW EXECUTE FUNCTION enforce_coverage_reversal_append_only();
