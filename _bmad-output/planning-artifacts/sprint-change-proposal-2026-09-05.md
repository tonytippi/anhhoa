---
title: "Sprint Change Proposal - Exact settlement and Student promotional coverage"
status: final
created: 2026-09-05
mode: incremental
trigger: "Finance confirmed normal Invoice payment is all-or-nothing; new-Student promotional multi-period offers are back-office negotiated and refundable on withdrawal."
---

# Sprint Change Proposal - Exact settlement and Student promotional coverage

## 1. Issue Summary

Current PassionEdu finance planning models normal settlement with partial allocation and a derived `PARTIALLY_PAID` Invoice state. Finance confirmed that normal school operations instead treat an Invoice as unpaid or paid in full. The existing Prepayment concept also cannot model a negotiated new-Student promotional offer because the offer has named periods, receivables, price/discount snapshots and a withdrawal refund rule.

The approved target contract is:

- Normal settlement is exact: an Invoice remains `ISSUED` until a posted Receipt allocation settles its full outstanding amount, then becomes `PAID`; `PARTIALLY_PAID` is removed.
- One Receipt may settle multiple Invoices only when they belong to the same School and Student, and every selected Invoice is settled in full.
- Receipt excess becomes an explicit Finance-only Prepayment for that Student; partial and unallocated normal Receipt flows are rejected.
- A negotiated, new-Student promotional offer is a back-office-created Student promotional coverage, not a Parent self-service or recurring catalog package.
- Promotional coverage names covered periods and receivables, snapshots the price/discount, and prevents a monthly CollectionRun from charging only its covered receivable-period pair again.
- Withdrawal or transfer creates a refund preview based on remaining operating days from the School calendar. School Admin or Finance Manager may override the calculated VND amount only with a reason; the resulting refund remains append-only and follows the existing reversal approval mode.

## 2. Impact Analysis

### Epic Impact

- Epic 5 must add negotiated Student promotional coverage and its Invoice snapshot/CollectionRun exclusion behavior.
- Epic 6 must replace partial settlement with exact settlement, restrict Receipt grouping, retain explicit exceptional Prepayment, and add operating-day refund preview/override.
- Epic 7 Parent portal removes any partial-payment state assumption; it remains read-only and does not offer promotional selection, payment confirmation or refund mutation.
- No new epic is required. Epic order is unchanged.

### Artifact Impact

- PRD sections 3, 4.3, 4.4, 6, 7 and non-goals require finance-contract updates.
- Architecture Spine AD-7 and AD-13 require settlement, promotional coverage and refund-calculation invariants; related capability/module map and deferred list may need wording alignment.
- SPEC CAP-4, CAP-5 and constraints require the same preserved contract.
- UX `EXPERIENCE.md` Finance lifecycle, receipt/allocation, prepayment/debt, adjustment/refund patterns and Parent obligation state need exact-settlement wording. `DESIGN.md` has no material visual-token conflict.
- `epics-passionedu.md` requires revisions to Epic 5 and 6 stories before stories are finalized.
- Deployment, audience isolation, roster, attendance evidence and Parent authorization are unaffected.

### Technical Impact

- Add a School-scoped promotional-coverage aggregate with immutable issued source facts and non-overlapping coverage by Student, receivable and period.
- Finance posting transaction checks exact full settlement for each selected Invoice and creates explicit Prepayment only for Receipt excess.
- Refund preview uses a calendar as-of snapshot and a server-defined whole-VND rounding rule. Proposed rule: floor the prorated amount to a whole VND, then allow an audited override.

## 3. Recommended Approach

**Selected approach:** Direct Adjustment.

**Rationale:** The initiative has no implementation yet, so no rollback is justified. The change preserves the multi-Invoice audit ledger, limits normal settlement complexity, and models the actual promotional agreement as an obligation with explicit coverage rather than an ambiguous credit balance. Existing Epic 5/6 boundaries already own the needed changes.

**Scope:** Moderate. Product, architecture, UX and backlog contracts need coordinated updates; no new platform capability or epic is introduced.

**Risk:** Medium. Incorrect coverage overlap, calendar proration or refund provenance could cause duplicate billing/refunds; mitigate with server-side uniqueness, snapshot rules and integration fixtures.

## 4. Detailed Change Proposals

### Proposal 1: PRD finance settlement and promotional coverage

**Status:** Approved by Product, pending artifact application.

**Sections affected:** 3 Terms; 4.3 FR-7 through FR-9; 4.4 FR-10 through FR-11; 6 Release scope; 7 Quality/governance; 5 Non-goals.

**Current contract:**

> Receipt, allocation and Prepayment support ledger-derived `PARTIALLY_PAID`/`PAID` settlement; Prepayment is the available model for advance payment.

**Proposed contract:**

> Normal Invoice settlement is exact: `ISSUED` remains unpaid until one posted Receipt transaction fully settles the selected Invoice, then it is `PAID`; `PARTIALLY_PAID` is not a state. One Receipt may settle multiple Invoices only for one Student in one School and must fully settle every selected Invoice. Excess is an explicit Finance-only Prepayment for that Student; partial or unallocated normal Receipt postings are rejected.
>
> A School Admin or Finance Manager may create a negotiated Student promotional coverage for named receivable-period pairs, typically for a new Student after an offline agreement. It is not a recurring catalog package and has no Parent self-service flow. The issued promotional Invoice snapshots coverage, price, discount, enrollment/class, BankAccount and payment instruction. A monthly CollectionRun skips only the covered Student/receivable/period pair and identifies that skip reason.
>
> On withdrawal or transfer, the server previews a promotional-coverage refund from snapshot value and remaining operating days according to the School calendar as of the coverage. `calculatedAmount` is rounded down to whole VND. School Admin or Finance Manager may submit a different `approvedAmount` only with a reason. Refund is append-only, source-linked and governed by the School reversal mode; it never rewrites the original Invoice, Receipt or coverage.

**Rationale:** Aligns the product contract with confirmed operations while retaining auditable exceptional handling and making the new-Student promotion/refund rule explicit.

### Proposal 2: Architecture Spine finance invariant

**Status:** Approved by Product, pending artifact application.

**Sections affected:** AD-7 Finance obligation and ledger model; AD-13 Attendance-to-finance adjustment contract; Capability to Architecture Map for finance; verification boundary where settlement fixtures are named.

**Current contract:**

> A finance posting boundary rejects allocation above Receipt/Invoice outstanding, Prepayment application above source/Invoice outstanding, and cross-Student use. Paid/outstanding status is derived from validated ledger records.

**Proposed contract:**

> A finance posting boundary serializes every settlement writer with a consistent lock order. Normal Receipt settlement accepts a set of target Invoices only when all targets belong to one School and Student and each target is settled exactly to its outstanding amount in that posting; an Invoice derives only `ISSUED` or `PAID`, never `PARTIALLY_PAID`. Receipt excess is posted only as an explicit Prepayment tied to that Student; a normal partial or unallocated Receipt is rejected. Existing limits continue to reject cross-Student use, source/Invoice over-application and voided targets.
>
> `finance` owns `StudentPromotionalCoverage`: a School-scoped, Student-scoped set of named receivable-period coverage facts created only by School Admin or Finance Manager and snapshotted into its issued promotional Invoice. The database and owning command prevent overlapping issued coverage for the same Student, receivable and period. CollectionRun selection excludes only a covered Student/receivable/period and records `COVERED_BY_PROMOTIONAL_COVERAGE`; it does not suppress other eligible receivables.
>
> Withdrawal/transfer refund preview reads the coverage price/discount snapshot and the School calendar version applicable to that coverage. It calculates `eligibleOperatingDays`, `remainingOperatingDays` excluding the withdrawal effective date, and `calculatedAmount = floor(snapshotCoverageAmount * remainingOperatingDays / eligibleOperatingDays)` in VND. A posted refund records calculated and approved amounts, override reason when different, coverage/source Invoice/Receipt provenance and approval-mode outcome. It appends records only and never mutates the original obligation, settlement or coverage facts.

**Verification additions:**

- PostgreSQL integration fixtures prove exact multi-Invoice settlement for one Student, rejection of partial/mixed-Student/unallocated postings, explicit excess Prepayment, and no duplicate post under retries/concurrency.
- Fixtures prove promotional coverage scoped uniqueness and no duplicate monthly charge for a covered receivable-period while unrelated receivables still generate.
- Fixtures prove calendar operating-day calculation, withdrawal-date exclusion, floor rounding, mandatory override reason, source provenance and append-only refund correction.

**Rationale:** Moves all money semantics to the finance transaction boundary and makes the coverage/refund calculation reproducible from immutable source facts rather than UI interpretation or current catalog values.

### Proposal 3: SPEC finance capabilities and constraints

**Status:** Approved by Product, pending artifact application.

**Sections affected:** CAP-4, CAP-5 and Constraints.

**Current contract:**

> CAP-5 describes receipts, allocations, prepayments, reversals, refunds, debt and reports through a ledger, without defining exact settlement or promotional coverage.

**Proposed contract:**

> CAP-4 extends CollectionRun selection to skip only Student receivable-period facts covered by an issued negotiated promotional coverage, while retaining all other eligible charges. Coverage is created by School Admin or Finance Manager, not Parent self-service.
>
> CAP-5 defines normal settlement as exact: a Receipt may settle one or more Invoices for one Student in one School only when it settles each Invoice in full; the derived Invoice state is `PAID`, never partial. Excess becomes explicit Student Prepayment. Negotiated Student promotional coverage snapshots named periods, receivables and discount into the issued obligation. On withdrawal or transfer, a server preview prorates unused coverage from the applicable School calendar's remaining operating days, floors VND, and permits an audited School Admin/Finance override before append-only refund approval/posting.
>
> Constraints require that issued coverage, obligation and payment instruction remain immutable; normal partial/unallocated Receipt posting and Parent package/refund/payment mutation are excluded. The API owns coverage overlap validation, run exclusion, proration, exact settlement, audit and ledger transition.

**Rationale:** Preserves the newly approved finance semantics in the concise downstream build contract and removes ambiguity that could reintroduce partial settlement or Parent self-service.

### Proposal 4: UX exact settlement and back-office promotional coverage

**Status:** Approved by Product, pending artifact application.

**Sections affected:** `ux-passionedu-2026-09-04/EXPERIENCE.md` component patterns, state patterns, Finance lifecycle table, interaction primitives and Finance/Parent flows. `DESIGN.md` needs no token or visual-language change.

**Current contract:**

> Receipt/allocation form allows partial settlement and the Finance lifecycle table renders `PARTIALLY_PAID` / `PAID`; adjustment/refund only names generic source and amount.

**Proposed contract:**

> Receipt settlement starts from a selected Student and a server-returned set of eligible issued Invoices. The UI shows the exact total required to settle each selected Invoice, disables a partial selection, and requires explicit handling of any excess as Student Prepayment. It never presents a generic unallocated balance or cross-Student selection.
>
> Finance may create a negotiated Student promotional coverage from the Student/Invoice workflow. The review screen names Student, covered receivable-period pairs, snapshot price/discount, reason, coverage overlap/eligibility result and the resulting DRAFT/issued obligation. There is no Parent package catalog, request or selection UI.
>
> Promotional withdrawal/transfer refund review shows source coverage/Invoice/Receipt, calendar operating days used and remaining, server `calculatedAmount`, editable `approvedAmount`, and a required reason when amounts differ. The confirmation states approval mode and append-only result; it never edits the source facts.
>
> Finance lifecycle renders `ISSUED` and `PAID` only for normal settlement. `PAID` displays ledger-derived as-of time. The Parent obligation view remains read-only and hides payment invitation when no outstanding; it does not expose promotional creation, refund controls, partial-payment state or payment confirmation.

**Accessibility and state additions:**

- The exact settlement total, excess Prepayment choice and partial rejection are text-explained, keyboard reachable and server-confirmed.
- Coverage overlap, no eligible period, withdrawal/refund calculation failure, policy approval wait and timeout all retain immutable source facts, focus the error/reconciliation result and do not imply a local completion.
- Finance review tables keep VND right-alignment and accessible captions; Parent still has 44px touch targets and no hover dependence.

**Rationale:** Makes the normal payment path simple and truthful, while rendering the negotiated promotion/refund exception as a deliberate, auditable Finance workflow without expanding Parent scope.

### Proposal 5: Epic 5 and Epic 6 story revisions

**Status:** Approved by Product, pending artifact application.

**Sections affected:** `epics-passionedu.md` Story 5.1 through 5.6 and Story 6.1 through 6.6; Epic 7 wording only where it names normal payment state.

**Current contract:**

> Epic 5 has catalog, CollectionRun and Invoice issuance stories but no negotiated promotional coverage. Epic 6 permits partial Receipt allocation and presents `PARTIALLY_PAID` as normal settlement.

**Proposed story changes:**

| Story | Change |
| --- | --- |
| 5.1 | Keep catalog/discount/ChargeRule scope. State that recurring catalog rules do not create negotiated Student promotional coverage. |
| 5.2 | Add preview skip reason `COVERED_BY_PROMOTIONAL_COVERAGE`, scoped only to Student/receivable/period. |
| 5.3 | Preserve coverage exclusion during generate and assert unrelated receivables still generate. |
| 5.4 | Add Finance/Admin creation/review of `StudentPromotionalCoverage`: named receivable-period pairs, snapshot price/discount, reason, overlap validation and source audit. |
| 5.5 | Issue a promotional Invoice with immutable coverage facts; forbid issued coverage overlap and remove `PARTIALLY_PAID` from derived state examples. |
| 5.6 | Add coverage overlap/skip and issued snapshot integration tests. |
| 6.1 | Replace partial allocation with exact settlement: select one Student and one or more issued Invoices, require full outstanding for every target, reject partial/mixed-Student/unallocated posting, and derive only `PAID`. |
| 6.2 | Narrow Prepayment to explicit Finance-only Receipt excess for one Student; retain bounded application to future Invoice, no generic credit. |
| 6.3 | Add promotional withdrawal/transfer refund preview with operating-day snapshot proration, floor VND, override reason and existing approval mode. |
| 6.4 | Retain prior-debt flow but state its target Invoice must be settled exactly when paid. |
| 6.5 | Remove partial-payment grouping/filter assumptions and include promotional coverage/refund in ledger report provenance where applicable. |
| 6.6 | Add exact-settlement, excess, coverage overlap/exclusion and operating-day refund fixtures under concurrency/idempotency. |
| 7.x | Retain read-only Parent payment instruction; state it only represents outstanding `ISSUED` obligation and never partial/payment-confirmation/package/refund action. |

**Revised story sequence:**

- Epic 5 remains six stories. Story 5.4 becomes the promotional coverage review/adjustment boundary before Story 5.5 issuance.
- Epic 6 remains six stories. Story 6.1 exact Receipt settlement precedes exceptional Prepayment in Story 6.2 and promotional refund in Story 6.3.
- No story or epic renumbering is necessary; release order remains unchanged.

**Rationale:** Preserves planned vertical slices and minimizes backlog churn while making the normal and exceptional finance paths unambiguous for implementation and testing.

## 5. Implementation Handoff

**Scope classification:** Moderate.

- Product/Architecture: Apply approved PRD, Spine and SPEC contract changes and revalidate preservation across finance rules.
- UX: Apply approved `EXPERIENCE.md` changes and revalidate lifecycle/state/accessibility behavior.
- Product Owner/Developer: Apply approved Epic 5/6/7 story revisions, rerun breakdown validation and update sprint status from the replacement epic artifact.
- Developer: Implement only after final artifact updates; cover exact settlement, coverage, refund and all release gates in unit, PostgreSQL integration and portal E2E suites.

**Success criteria:** No normal partial settlement path, no Parent promotional/payment/refund mutation, no duplicate covered receivable-period Invoice, refunds reproduce their preview from snapshots/calendar and every exception has ledger/audit/Operation provenance.

## 6. Review Checklist

- [x] Trigger identified: Story 6.1 exposed a mismatch between partial-settlement planning and confirmed operating practice.
- [x] Evidence recorded: Finance confirmation that normal Invoices are unpaid or fully paid; excess/multi-Invoice payment remains exceptional.
- [x] Epic impact assessed: Epic 5, Epic 6 and limited Epic 7 wording change; no new epic or changed ordering.
- [x] PRD impact assessed and proposal approved.
- [x] Architecture impact assessed and proposal approved.
- [x] SPEC impact assessed and proposal approved.
- [x] UX impact assessed and proposal approved.
- [x] Backlog/story impact assessed and proposal approved.
- [x] Direct adjustment selected: no implementation exists, so rollback is not justified and MVP scope remains achievable.
- [x] Handoff and success criteria defined.
- [!] Final proposal approval required before modifying final PRD, Architecture Spine, SPEC and UX artifacts.
- [N/A] Existing implementation rollback: no replacement implementation has started.
