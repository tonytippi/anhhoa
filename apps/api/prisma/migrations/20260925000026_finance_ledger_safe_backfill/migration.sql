-- Only source rows with an immutable posting timestamp are projected. Cancellation has
-- no historical cancellation timestamp in the pre-ledger schema and is intentionally not inferred.
INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "postedAt", "invoiceId", "collectionRunId", "schoolYearId", "studentId", "billingMonth", "className", "statusSnapshot", "grossAmount", "netAmount", "provenance")
SELECT i."schoolId", 'INVOICE_ISSUED', i."issuedAt", i."id", i."collectionRunId", i."schoolYearId", i."studentId", i."billingMonth", i."classNameSnapshot", 'ISSUED', i."obligationTotalSnapshot", i."obligationTotalSnapshot", jsonb_build_object('backfill', true, 'invoiceId', i."id", 'billingMonth', i."billingMonth")
FROM "Invoice" i WHERE i."issuedAt" IS NOT NULL AND i."status" <> 'CANCELLED'
  AND NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = i."schoolId" AND e."type" = 'INVOICE_ISSUED' AND e."invoiceId" = i."id");
INSERT INTO "FinanceLedgerEvent" ("schoolId", "type", "postedAt", "invoiceId", "schoolYearId", "studentId", "amount", "provenance")
SELECT r."schoolId", 'RECEIPT_POSTED', r."postedAt", r."invoiceId", r."schoolYearId", r."studentId", r."actualAmount", jsonb_build_object('backfill', true, 'receiptId', r."id", 'outcome', r."outcome")
FROM "Receipt" r WHERE NOT EXISTS (SELECT 1 FROM "FinanceLedgerEvent" e WHERE e."schoolId" = r."schoolId" AND e."type" = 'RECEIPT_POSTED' AND e."provenance" ->> 'receiptId' = r."id"::text);
