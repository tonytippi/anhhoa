-- Amendment 2026-10-01 A1: the refund price of a receivable never exceeds its charged price.
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_refundUnitPrice_within_price" CHECK ("refundUnitPrice" <= "defaultUnitPrice");

-- A1: the "Bớt" unit price of a line never exceeds the line unit price, except the settlement prepaid
-- package refund, which refunds a whole-package amount on a "Thu 0" line.
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_refund_price_within_price" CHECK (
  "refundUnitPriceSnapshot" <= "unitPrice"
  OR ("deductionSource" ->> 'type') IS NOT DISTINCT FROM 'PREPAID_PACKAGE_V1'
);

-- A2: only a settlement Invoice may leave DRAFT with a negative total.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_negative_total_settlement_only" CHECK (
  "kind" = 'SETTLEMENT' OR "status" = 'DRAFT' OR "total" >= 0
);
