# Decision: Story 6.5 outstanding and CSV access

**Date:** 2026-09-26

## Decision

- Outstanding at `asOf` is calculated per current-effective Invoice as issued obligation minus actual Receipt and SettlementTransfer. SettlementDifference, carry, DebtTransfer, coverage and reversal/refund remain distinct immutable reconciliation/provenance facts; carry and debt affect an obligation only after materialization into an Invoice line.
- Any currently authorized actor with `FINANCE_MANAGE` in the same School may download an unexpired, unrevoked opaque CSV export. The export creator membership remains request provenance; every download re-authorizes and audits the actual downloader.
- Coverage reversal/refund reduces cash/reconciliation totals and appears in cash/adjustment provenance. It never reopens or increases the source Invoice outstanding.

## Consequences

- The outstanding workspace must expose the per-Invoice effective formula and separate event rows/totals that explain difference, carry, debt, coverage and refund/reversal without inventing a generic balance.
- CSV download remains protected by same-School capability re-authorization. Its audit must identify both requester provenance and the downloading actor.
- Correction/replacement continues to be the only lifecycle that changes the effective obligation projection; this decision adds no payment recovery, write-off or generic balance workflow.
