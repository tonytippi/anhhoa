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
  - **intent:** Finance users can configure receivables and CollectionRuns, review authoritative previews and create draft obligations for eligible Students.
  - **success:** A Student has at most one Invoice in a CollectionRun; generation reconciles through its Operation and never duplicates an Invoice after retry or timeout.
- **CAP-5**
  - **intent:** Finance users can issue snapshot obligations and maintain receipts, allocations, prepayments, reversals, refunds, debt and reports through a ledger.
  - **success:** Reports reconcile gross, discount/refund, receipt, allocation, prepayment and outstanding; corrections use audited postings rather than history mutation.
- **CAP-6**
  - **intent:** Authorized users can manage leave, attendance, services and handover under School policy, supplying Finance with references for controlled adjustments.
  - **success:** Unauthorized writes are denied; holiday and confirmed-PRESENT leave conflicts are excluded from meal adjustments; REQUIRED evidence blocks PRESENT without evidence, remains Staff/Admin-only, and its blob is deleted after two calendar months; Finance creates only source-linked idempotent adjustments, never automatic charges.
- **CAP-7**
  - **intent:** Parents can use a multi-School, read-only portal to view authorized obligations and snapshot payment instructions for their children.
  - **success:** Parent data is limited to active authorization; logout, expiry and revoke clear protected client state; Parents cannot post or confirm finance activity.

## Constraints

- `School` scopes every business record, policy, query, audit record and idempotent Operation; authorization is server-side on every request and does not trust browser-selected context, UUIDs, headers or filters.
- API owns authorization, policy evaluation, VND integer calculation, state transitions, snapshots and reports; portal apps consume REST contracts only.
- Issued obligations and Payment instructions are immutable snapshots; finance postings are append-only. High-impact cookie mutations require origin validation, double-submit CSRF, idempotency and Operation reconciliation.
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
