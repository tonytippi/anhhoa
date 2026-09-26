ALTER TABLE "FinanceReportExport" ADD COLUMN "operationId" uuid;

INSERT INTO "Operation" ("id", "schoolId", "membershipId", "actorIdentityId", "actorType", "actorReference", "route", "fingerprint", "idempotencyKey", "status", "outcome", "createdAt", "updatedAt")
SELECT e."id", e."schoolId", e."membershipId", m."userIdentityId", 'SCHOOL_MEMBERSHIP', e."membershipId", 'POST /api/app/schools/:schoolId/finance/reports/:workspace/exports', 'legacy-finance-report-export', e."id"::text, 'COMPLETED', jsonb_build_object('exportId', e."id", 'expiresAt', e."expiresAt", 'workspace', e."workspace"), e."createdAt", e."createdAt"
FROM "FinanceReportExport" e
JOIN "SchoolMembership" m ON m."schoolId" = e."schoolId" AND m."id" = e."membershipId"
ON CONFLICT ("id") DO NOTHING;

UPDATE "FinanceReportExport" SET "operationId" = "id" WHERE "operationId" IS NULL;
ALTER TABLE "FinanceReportExport" ALTER COLUMN "operationId" SET NOT NULL;
ALTER TABLE "FinanceReportExport" ADD CONSTRAINT "FinanceReportExport_schoolId_operationId_fkey" FOREIGN KEY ("schoolId", "operationId") REFERENCES "Operation"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FinanceReportExport_schoolId_operationId_key" ON "FinanceReportExport"("schoolId", "operationId");

CREATE OR REPLACE FUNCTION enforce_coverage_reversal_limits() RETURNS trigger AS $$
DECLARE coverage "StudentPromotionalCoverage"; invoice "Invoice"; receipt "Receipt"; total_reversed bigint;
BEGIN
  SELECT * INTO coverage FROM "StudentPromotionalCoverage" WHERE "id" = NEW."coverageId" AND "schoolId" = NEW."schoolId" FOR UPDATE;
  SELECT * INTO invoice FROM "Invoice" WHERE "id" = coverage."sourceInvoiceId" AND "schoolId" = NEW."schoolId";
  SELECT * INTO receipt FROM "Receipt" WHERE "id" = coverage."sourceReceiptId" AND "schoolId" = NEW."schoolId";
  IF NEW."amount" <= 0 OR NEW."calculatedAmount" < 0 OR invoice."status" NOT IN ('CLOSED', 'CANCELLED') OR receipt."invoiceId" <> invoice."id" OR receipt."outcome" <> 'EXACT' THEN RAISE EXCEPTION 'Coverage reversal requires a positive exact paid source'; END IF;
  IF NEW."requestId" IS NULL AND invoice."reversalModeSnapshot" <> 'DIRECT' THEN RAISE EXCEPTION 'Coverage reversal requires School Admin approval'; END IF;
  SELECT COALESCE(sum("amount"), 0) INTO total_reversed FROM "CoverageReversal" WHERE "schoolId" = NEW."schoolId" AND "coverageId" = NEW."coverageId";
  IF total_reversed + NEW."amount" > coverage."originalPrice" - coverage."reduction" THEN RAISE EXCEPTION 'Coverage reversal exceeds remaining paid source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
