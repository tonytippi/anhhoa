# Decision: Parent obligation and payment snapshot contract

**Date:** 2026-09-27

## Decision

Story 7.6 exposes a Finance-owned, Parent-specific read projection for current-effective obligations only.

### Retention

- Add `ParentAccessPolicyVersion`, School-scoped, effective-dated and audited, with a default retained-CLOSED finance visibility period of 12 months.
- Effective `ISSUED` obligations with outstanding balance remain visible while unsettled.
- `CLOSED` obligations remain visible until all relevant settlement is complete, then follow the effective Parent access policy retention.
- A coverage refund/reversal obligation remains minimally visible while its related refund/reversal settlement is unresolved, regardless of the normal closed retention timer.
- Retention is decided and enforced only by the server.

### Obligation snapshot

- Add immutable `obligationCodeSnapshot` when Invoice is issued, unique per School.
- Format is server-generated `OBL-YYYYMM-<sequence>`; neither client data nor UUID/student code determines it.
- Parent reads only the current-effective Invoice in a revision lineage. A `CANCELLED` source never appears; its effective replacement is the only exposed obligation.

### Finance-owned Parent projection

- Finance exports a narrow Parent projection/query. Parent controller/service does not duplicate outstanding calculation.
- Server derives outstanding from Finance facts including actual Receipt, SettlementTransfer and debt-transfer reduction, without exposing their identifiers or provenance.
- Parent `effectiveAt` is the latest permitted lifecycle instant among `issuedAt`, Receipt `postedAt` and SettlementTransfer `createdAt`; no underlying source detail is returned.

### Payment snapshot display

- A retained `CLOSED` obligation may display its historical payment instruction snapshot as read-only record context.
- Payment invitation/action is shown only when server-derived `outstanding > 0`.
- There is never “I paid”, payment confirmation, QR, copy field, bank deep link, receipt/refund/package selection or other Parent finance mutation.

## Rationale

The Finance module owns ledger-derived truth, revision lineage and settlement. Immutable issued snapshots make the Parent obligation stable after BankAccount or catalog changes, while a narrow projection prevents finance provenance and mutable administrative data from crossing the Parent boundary.
