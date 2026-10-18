-- Sprint change 2026-10-17 (sprint-change-proposal-2026-10-17-invoice-approval.md): a manager approves each Invoice
-- notice before it reaches parents. The new value is added in its own migration so later migrations can use it.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' AFTER 'DRAFT';
