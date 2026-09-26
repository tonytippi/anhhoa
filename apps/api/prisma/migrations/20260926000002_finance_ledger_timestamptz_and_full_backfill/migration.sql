-- Application timestamps have always been written as UTC instants. Preserve that
-- meaning while making comparison with timezone-qualified report cutoffs explicit.
ALTER TABLE "FinanceLedgerEvent"
  ALTER COLUMN "postedAt" TYPE TIMESTAMPTZ(3) USING "postedAt" AT TIME ZONE 'UTC';

-- Every INSERT uses its immutable source primary key as sourceKey and is safe to rerun.
-- Cancellation is deliberately absent: pre-ledger data has no cancellation timestamp.
INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "collectionRunId", "schoolYearId", "studentId", "billingMonth", "className", "groupName", "statusSnapshot", "grossAmount", "discountAmount", "netAmount", "provenance")
SELECT i."schoolId", 'INVOICE_ISSUED', i."id"::text, i."issuedAt" AT TIME ZONE 'UTC', i."id", i."collectionRunId", i."schoolYearId", i."studentId", i."billingMonth", i."classNameSnapshot", groups."groupName", 'ISSUED', COALESCE(lines."gross", i."obligationTotalSnapshot"), COALESCE(lines."discount", 0), i."obligationTotalSnapshot", jsonb_build_object('backfill', true, 'legacyEffectiveUnknown', i."status" = 'CANCELLED', 'invoiceId', i."id", 'collectionRunId', i."collectionRunId", 'schoolYearId', i."schoolYearId", 'studentId', i."studentId", 'billingMonth', i."billingMonth", 'className', i."classNameSnapshot", 'lines', COALESCE(lines."items", '[]'::jsonb))
FROM "Invoice" i
LEFT JOIN LATERAL (SELECT SUM("grossAmount") AS "gross", SUM("discountAmount") AS "discount", jsonb_agg(jsonb_build_object('id', l."id", 'kind', l."kind", 'receivableId', l."receivableId", 'receivableName', l."receivableNameSnapshot", 'grossAmount', l."grossAmount"::text, 'discountAmount', l."discountAmount"::text, 'netAmount', l."netAmount"::text)) AS "items" FROM "InvoiceLine" l WHERE l."schoolId" = i."schoolId" AND l."invoiceId" = i."id") lines ON true
LEFT JOIN LATERAL (SELECT string_agg(DISTINCT g."name", ' | ' ORDER BY g."name") AS "groupName" FROM "InvoiceLine" l LEFT JOIN "Receivable" r ON r."schoolId" = l."schoolId" AND r."id" = l."receivableId" LEFT JOIN "ReceivableGroup" g ON g."schoolId" = r."schoolId" AND g."id" = r."groupId" WHERE l."schoolId" = i."schoolId" AND l."invoiceId" = i."id") groups ON true
WHERE i."issuedAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = i."schoolId" AND e."type" = 'INVOICE_ISSUED' AND e."invoiceId" = i."id")
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT r."schoolId", 'RECEIPT_POSTED', r."id"::text, r."postedAt" AT TIME ZONE 'UTC', r."invoiceId", r."schoolYearId", r."studentId", r."actualAmount", jsonb_build_object('backfill', true, 'receiptId', r."id", 'outcome', r."outcome") FROM "Receipt" r WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = r."schoolId" AND e."type" = 'RECEIPT_POSTED' AND e."provenance" ->> 'receiptId' = r."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT d."schoolId", 'SETTLEMENT_DIFFERENCE_POSTED', d."id"::text, d."createdAt" AT TIME ZONE 'UTC', d."invoiceId", d."schoolYearId", d."studentId", d."signedAmount", jsonb_build_object('backfill', true, 'settlementDifferenceId', d."id", 'receiptId', d."receiptId") FROM "SettlementDifference" d WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = d."schoolId" AND e."type" = 'SETTLEMENT_DIFFERENCE_POSTED' AND e."provenance" ->> 'settlementDifferenceId' = d."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT c."schoolId", 'SETTLEMENT_CARRY_POSTED', c."id"::text, c."createdAt" AT TIME ZONE 'UTC', c."invoiceId", c."schoolYearId", c."studentId", c."amount", jsonb_build_object('backfill', true, 'settlementCarryId', c."id", 'settlementDifferenceId', c."settlementDifferenceId", 'type', c."type") FROM "SettlementCarry" c WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = c."schoolId" AND e."type" = 'SETTLEMENT_CARRY_POSTED' AND e."provenance" ->> 'settlementCarryId' = c."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT t."schoolId", 'SETTLEMENT_TRANSFER_POSTED', t."id"::text, t."createdAt" AT TIME ZONE 'UTC', t."replacementInvoiceId", t."schoolYearId", t."studentId", t."amount", jsonb_build_object('backfill', true, 'settlementTransferId', t."id", 'sourceInvoiceId', t."sourceInvoiceId", 'sourceReceiptId', t."sourceReceiptId", 'replacementInvoiceId', t."replacementInvoiceId") FROM "SettlementTransfer" t WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = t."schoolId" AND e."type" = 'SETTLEMENT_TRANSFER_POSTED' AND e."provenance" ->> 'settlementTransferId' = t."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT d."schoolId", 'DEBT_TRANSFER_POSTED', d."id"::text, d."createdAt" AT TIME ZONE 'UTC', d."sourceInvoiceId", d."schoolYearId", d."studentId", d."amount", jsonb_build_object('backfill', true, 'debtTransferId', d."id", 'targetInvoiceId', d."targetInvoiceId", 'targetLineId', d."targetLineId", 'reason', d."reason") FROM "DebtTransfer" d WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = d."schoolId" AND e."type" = 'DEBT_TRANSFER_POSTED' AND e."provenance" ->> 'debtTransferId' = d."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT c."schoolId", 'COVERAGE_ISSUED', c."id"::text, c."issuedAt" AT TIME ZONE 'UTC', c."sourceInvoiceId", c."schoolYearId", c."studentId", c."originalPrice" - c."reduction", jsonb_build_object('backfill', true, 'coverageId', c."id", 'sourceFactId', c."sourceFactId", 'sourceReceiptId', c."sourceReceiptId", 'receivableId', c."receivableId", 'coveredBillingMonth', c."billingMonth") FROM "StudentPromotionalCoverage" c WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = c."schoolId" AND e."type" = 'COVERAGE_ISSUED' AND e."provenance" ->> 'coverageId' = c."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;

INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "sourceKey", "postedAt", "invoiceId", "amount", "provenance")
SELECT r."schoolId", 'COVERAGE_REVERSAL_POSTED', r."id"::text, r."postedAt" AT TIME ZONE 'UTC', c."sourceInvoiceId", -r."amount", jsonb_build_object('backfill', true, 'coverageReversalId', r."id", 'coverageId', r."coverageId", 'requestId', r."requestId", 'effectiveOn', r."effectiveOn", 'calculatedAmount', r."calculatedAmount"::text, 'reason', r."reason") FROM "CoverageReversal" r JOIN "StudentPromotionalCoverage" c ON c."schoolId" = r."schoolId" AND c."id" = r."coverageId" WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = r."schoolId" AND e."type" = 'COVERAGE_REVERSAL_POSTED' AND e."provenance" ->> 'coverageReversalId' = r."id"::text)
ON CONFLICT ("schoolId", "type", "sourceKey") DO NOTHING;
