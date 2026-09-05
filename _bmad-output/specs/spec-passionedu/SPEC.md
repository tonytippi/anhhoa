---
id: SPEC-passionedu
companions:
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md
  - ../../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
sources:
  - ../../planning-artifacts/sprint-change-proposal-2026-08-31.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

# PassionEdu multi-school operations platform

## Why

PassionEdu replaces the single-school invoice product with a clean-break platform where each kindergarten operates roster, finance and class operations independently without exposing child data or operating authority across Schools. Anh Hoa is the first tenant, not the product boundary.

## Capabilities

- **CAP-1**
  - **intent:** Platform Operators can provision, suspend and bootstrap an independent School without gaining its business-data access.
  - **success:** Provisioning is atomic; suspension denies the next School business request; Platform access never grants implicit School access.
- **CAP-2**
  - **intent:** Admin, Staff and Parent users can access only data and actions authorized in their current School context.
  - **success:** Cross-School read/write/report access is denied; revoke takes effect on the next request without removing valid access in another School.
- **CAP-3**
  - **intent:** Schools can manage effective-dated settings, SchoolYear, roster, Parent and Staff records while retaining operating history.
  - **success:** Each School maintains one active SchoolYear; transitions preserve auditable enrollment and assignment history without destructive overwrite.
- **CAP-4**
  - **intent:** Finance users can configure receivables and CollectionRuns, review authoritative previews and create draft obligations for eligible Students; School Admin or Finance Manager can apply negotiated Student promotional coverage for named receivable-period facts.
  - **success:** A Student has at most one Invoice in a CollectionRun; generation reconciles through its Operation and never duplicates an Invoice after retry or timeout. An issued promotional coverage skips only its covered Student receivable-period facts, while other eligible charges remain billable.
- **CAP-5**
  - **intent:** Finance users can issue snapshot obligations and maintain exact receipts, exceptional prepayments, reversals, refunds, debt and reports through a ledger.
  - **success:** A Receipt settles one or more Invoices for one Student in one School only when it pays each Invoice in full; excess is explicit Student Prepayment. Reports reconcile gross, discount/refund, receipt, allocation, prepayment and outstanding; corrections use audited postings rather than history mutation. Withdrawal/transfer refund previews prorate unused promotional coverage from remaining School-calendar operating days and require audit when an approved amount overrides the calculated VND amount.
- **CAP-6**
  - **intent:** Authorized users can manage leave, attendance, services and handover under School policy, supplying Finance with references for controlled adjustments.
  - **success:** Unauthorized writes are denied; holiday and confirmed-PRESENT leave conflicts are excluded from meal adjustments; REQUIRED evidence blocks PRESENT without evidence, remains Staff/Admin-only, and its blob is deleted after two calendar months; Finance creates only source-linked idempotent adjustments, never automatic charges.
- **CAP-7**
  - **intent:** Parents can use a multi-School portal to view authorized daily attendance, obligations and snapshot payment instructions for their children, and submit only permitted leave requests.
  - **success:** Parent sees only their authorized Student's `PRESENT`, `ABSENT`, `ON_LEAVE` or clearly non-absent `NOT_RECORDED` status; Staff, internal reasons and evidence stay hidden; logout, expiry and revoke clear protected client state; Parents cannot mutate attendance or post/confirm finance activity.

## Constraints

- `School` scopes every business record, policy, query, audit record and idempotent Operation; authorization is server-side on every request and does not trust browser-selected context, UUIDs, headers or filters.
- API owns authorization, policy evaluation, VND integer calculation, state transitions, snapshots and reports; portal apps consume REST contracts only.
- Issued obligations, Student promotional coverage and Payment instructions are immutable snapshots; finance postings are append-only. Normal partial or unallocated Receipt posting is rejected, Parent has no package/refund/payment mutation, and the API owns coverage overlap validation, run exclusion, proration, exact settlement, audit and ledger transition. High-impact cookie mutations require origin validation, double-submit CSRF, idempotency and Operation reconciliation.
- Parent authorization derives only from active StudentParent links, applies retention server-side, exposes minimum DTOs and never caches protected responses in the service worker.
- Tenant isolation, revoke, ledger concurrency/idempotency and Parent cross-School behavior are pilot release gates. The VPS pilot builds from source without a registry or backup; production recovery, performance, rate-limit and cloud decisions require a Spine update before public/operational rollout.

## Non-goals

- Compatibility layers, dual legacy schema/finance lifecycle, or production migration as part of this clean-break.
- Bank synchronization, webhooks, virtual accounts or Parent payment confirmation.
- VAT calculation, custom-role UI, Organization hierarchy, custom School domains, JIT support access or live shared catalogs.
- Chat, SMS/Zalo/email, albums, daily journals, medical/medication, transport, pickup authorization, HR/payroll and import/export.
- Automatic pricing from attendance/handover/service enrollment, automatic late-pickup fees, or Parent finance/service-cancellation mutations.

## Success signal

- Every release passes the mandatory cross-tenant authorization suite; CollectionRun generation and finance report fixtures reconcile without duplicate posting.
- In a 30-day pilot, at least 90% of School setup fixtures complete without technical intervention, at least 95% of issued Invoices reconcile to the ledger, and no confirmed tenant leak or duplicate finance posting occurs.

## Assumptions

- Parent finance MVP presents read-only snapshot Payment instructions. VietQR, payment-field copy and bank deep links are separately gated enhancements.

## Open Questions

- When public or operational production rollout is planned, which registry, reverse proxy, backup/restore, monitoring, SLO, rate-limit and cloud-provider design will be adopted?
