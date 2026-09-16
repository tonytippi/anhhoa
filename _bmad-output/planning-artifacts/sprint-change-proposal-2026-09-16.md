---
name: Finance settlement and issued-invoice correction
status: approved
date: 2026-09-16
trigger: Business owner confirmed that actual receipt may differ from an issued Invoice and that an issued Invoice may require correction and resend.
---

# Sprint Change Proposal - Finance settlement and issued-invoice correction

## 1. Issue summary

The current contract requires exact normal settlement and rejects both partial and excess Receipts. It also makes an issued Invoice immutable without a defined revision/replacement flow. This does not match school operations: Finance records the amount actually received, confirms and closes the Invoice, and puts the shortage or excess into the next CollectionRun. If an issued Invoice is wrong, Finance must correct and resend it while retaining the original record.

## 2. Approved product decision

1. Finance records the actual received VND amount against an `ISSUED` Invoice. It may be lower than, equal to, or higher than its current outstanding amount.
2. Finance confirms receipt and closes the Invoice in one idempotent, append-only posting. A closed Invoice records a derived settlement outcome of `EXACT`, `SHORTFALL`, or `OVERPAYMENT`; it is not editable or reopened.
3. A non-exact close creates a source-linked append-only `SettlementDifference`. Finance never creates an independent Student balance, generic credit, or unallocated Receipt.
4. The server materializes the open difference as a positive `SHORTFALL_CARRY` or negative `OVERPAYMENT_CARRY` adjustment in the next eligible `MONTHLY` CollectionRun for the same Student, School, and SchoolYear. An overpayment adjustment cannot make its target Invoice negative. Any unapplied remainder stays on the source-linked SettlementDifference and is carried to a later eligible run with the same provenance.
5. An issued Invoice correction creates an audited revision chain. Finance prepares a corrected replacement Invoice from a snapshot of the source, reviews it, and issues it atomically with changing the old Invoice to `CANCELLED`. The original Invoice, issue snapshot, Receipt and audit history are never overwritten.
6. If the cancelled Invoice already has a confirmed Receipt, the revision workflow writes an append-only source-linked settlement-transfer projection to the replacement Invoice before its final close. Any remaining variance follows the same SettlementDifference rule. It never silently moves or rewrites the original Receipt or Allocation.
7. Parent sees only the current effective Invoice and its payment instruction snapshot. The Parent may see that a prior Invoice was replaced, but cannot access internal correction reasons, ledger transfers, approval actions, or finance mutations.

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD | Replace exact-only payment semantics, define close outcomes/carry adjustments, and add issued Invoice revision/cancellation requirements. |
| Architecture Spine | Replace exact-settlement invariant with controlled actual-receipt close and source-linked carry/revision invariants. Add concurrency, idempotency and lineage requirements. |
| SPEC | CAP-5, constraints and exclusions must stop excluding partial/excess receipt outcomes while preserving no generic balance and append-only history. |
| Epics | Rewrite Epic 6 settlement stories and add an Epic 5 Invoice revision story plus release tests. |
| UX | Receipt and Invoice review must show actual received amount, outcome, next-run carry, revision chain and reconciliation states. Parent projection must show effective replacement Invoice only. |

## 4. Recommended approach

Directly adjust the backlog before implementation. No implementation story has started, so no rollback or data migration is required. This is a moderate planning change: Product, Architecture, UX and QA contracts change together, while the multi-school, VND `BIGINT`, server-authoritative, append-only and Parent read-only invariants remain unchanged.

## 5. Verification criteria

- A lower, exact and higher actual Receipt each close one eligible Invoice once and create no duplicate posting after retry/concurrency.
- Shortfall/excess is materialized only in a later same-Student, same-School, same-SchoolYear run with immutable source provenance; a negative carry never makes an Invoice total negative.
- No generic balance, cross-Student, cross-School or cross-SchoolYear carry/application is possible.
- An issued Invoice revision atomically creates the replacement/current-effective projection and cancels the source without overwriting snapshots or ledger records.
- A revision with a confirmed Receipt preserves original Receipt provenance through an append-only transfer projection and handles any variance through the normal carry rule.
- Parent cannot mutate payment/correction data and sees no obsolete Invoice as payable.
