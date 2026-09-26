# Decision: Epic 6 review remediation

**Date:** 2026-09-26

## Decision

- `SettlementDifference.signedAmount` uses the canonical sign: shortfall is positive (`issued - actual > 0`); overpayment is negative. Carry classification follows that sign.
- A coverage reversal/refund requires immutable, School-scoped eligibility evidence with an effective date. The supported reasons are `WITHDRAWAL`, `TRANSFER_OUT`, and `ELIGIBLE_SERVICE_CANCELLATION`; free-text refund reason, invoice cancellation, and class/year transfer are not evidence.
- A ReceivableGroup-filtered report aggregates only immutable invoice-line billed values for that group. Whole-invoice cash, settlement, carry, debt, coverage, and refund events are returned as unallocated provenance and are excluded from group totals until a separately approved immutable allocation model exists.
- Prior debt transfer reduces the source obligation for both actual-receipt settlement and outstanding reporting. The existing reporting decision is superseded on this point; the transfer remains a distinct append-only provenance event and materializes a target `PRIOR_DEBT` obligation exactly once.

## Consequences

- Refund commands and previews must resolve an immutable eligibility record before calculating operating days or accepting a posting.
- Finance reports must not proportionally invent group-level cash allocation.
- Existing receipt, carry, report, and UI regression tests must assert the corrected sign, source provenance, protected states, and new eligibility boundary.
