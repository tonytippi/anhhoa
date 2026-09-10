---
id: SPEC-passionedu
updated: 2026-09-08
companions:
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md
  - ../../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/payroll-module-roadmap-2026-09-08.md
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
  - **intent:** Admin, Teacher and Parent users can access only data and actions authorized in their current School context.
  - **success:** Cross-School read/write/report access is denied; revoke takes effect on the next request without removing valid access in another School.
- **CAP-3**
  - **intent:** Schools can manage effective-dated settings, SchoolYear, roster, Parent and Staff records while retaining operating history.
  - **success:** Each School maintains one active SchoolYear; transitions preserve auditable enrollment and assignment history without destructive overwrite. A StaffProfile is an operational actor only through an audited active same-School identity/membership binding, route capability and effective Class assignment.
- **CAP-4**
  - **intent:** Finance users can configure receivables and versioned promotion policies, review authoritative CollectionRun previews and create draft obligations for eligible Students. A policy can target one or more Receivables with typed quantity/unit rules, discounts, fulfillment and stacking; after a direct Parent agreement, School Admin can select an eligible `PREPAID_COVERAGE` policy/start period for a dedicated `PREPAID` CollectionRun.
  - **success:** A Student has at most one Invoice in a CollectionRun; generation reconciles through its Operation and never duplicates an Invoice after retry or timeout. Server evaluation is snapshotted and re-evaluated before issue. An issued promotion coverage has immutable per-period service intervals and paid source/policy-version provenance, skips only its covered Student receivable-period facts, while other eligible charges remain billable.
- **CAP-5**
  - **intent:** Finance users can issue snapshot obligations and maintain exact receipts, promotion coverage, reversals, refunds, debt and reports through a ledger.
  - **success:** A `PREPAID_COVERAGE` source Invoice contains all covered future periods and settles exactly for one Student in one School and SchoolYear, without an excess balance. Reports reconcile gross, promotion discount/refund, receipt, allocation, coverage and outstanding; corrections use audited postings rather than history mutation. Withdrawal, transfer or eligible service cancellation refund previews prorate each coverage fact from its immutable paid snapshot and remaining School-calendar operating days, reject a non-positive operating-day denominator, and require audit when an approved amount overrides the calculated VND amount.
- **CAP-6**
  - **intent:** Teachers can manage attendance, handover and daily journals only for effective assigned Classes; authorized users can manage leave and services under School policy, supplying Finance with controlled adjustment references.
  - **success:** Unauthorized writes are denied; holiday and confirmed-PRESENT leave conflicts are excluded from meal adjustments; REQUIRED attendance evidence blocks PRESENT without evidence, remains Teacher/Admin-only, and its blob is deleted after two calendar months. A daily journal has audited same-day versions and authorized JPEG/PNG/WebP media at most 10 MB each; Finance creates only source-linked idempotent adjustments, never automatic charges.
- **CAP-7**
  - **intent:** Parents can use a multi-School portal to view authorized daily attendance, daily journals and media, obligations and snapshot payment instructions for their children, and submit only permitted leave requests.
  - **success:** Parent sees only their authorized Student's `PRESENT`, `ABSENT`, `ON_LEAVE` or clearly non-absent `NOT_RECORDED` status and current journal within operational retention; Staff identity, internal reasons, attendance evidence and journal audit stay hidden; logout, expiry and revoke clear protected client state; Parents cannot mutate attendance, journal or finance activity.
- **CAP-8**
  - **intent:** A School admitted to optional Payroll can let the Accountant persona—an active same-School `FINANCE_MANAGER`, not a separate preset role—maintain effective-dated employment terms and turn uploaded timeclock facts into reviewed staff workday and late-care records when granted the dedicated capabilities.
  - **success:** Machine codes resolve to at most one effective Staff in the School; committed source events and corrections are audited; reviewed workday facts are tenant-isolated and ready to snapshot for payroll.
- **CAP-9**
  - **intent:** A `FINANCE_MANAGER` Accountant with `PAYROLL_PREPARE`/`PAYROLL_RECONCILE` calculates, materially edits, reconciles and submits versioned staff payroll; a School Admin whose identity did not prepare/materially edit or submit it uses `PAYROLL_APPROVE` to review/approve/refuse, School Admin with `PAYROLL_REOPEN` reopens unpaid approved work, and Finance Manager with `PAYROLL_PAYOUT_CONFIRM` confirms payout after approval.
  - **success:** The server rejects approval by any identity that prepared/materially edited or submitted the version even if it holds multiple grants; each payment component is explained by immutable source/policy snapshots; approved/paid history is never overwritten; correction deltas, payout and Excel reconciliation are auditable and retry-safe.

## Constraints

- `School` scopes every business record, policy, query, audit record and idempotent Operation; authorization is server-side on every request and does not trust browser-selected context, UUIDs, headers or filters.
- API owns authorization, policy evaluation, VND integer calculation, state transitions, snapshots, media access and reports; Admin, Teacher, Parent and Ops portal apps consume REST contracts only.
- A School can configure versioned PromotionPolicy records. A version selects one or more Receivable targets with typed unit/applied quantity and optional consecutive-period rule, fixed-VND or percentage discount, fulfillment mode, effective period, priority, stacking/exclusivity and optional Student assignment requirement. The server evaluates policies on DRAFT and again before Issue, snapshots applications, applies fixed VND before percentage with deterministic tie-breaks and never allows target discount above gross. Issued obligations, promotion coverage and Payment instructions are immutable snapshots; finance postings are append-only.
- `PREPAID_COVERAGE` is a PromotionPolicy fulfillment mode. A School Admin, not a Parent, selects an eligible policy and start month after direct agreement; the API creates a dedicated `PREPAID` CollectionRun/source Invoice, requires exact settlement without excess, and owns coverage overlap validation, ordinary-run exclusion, proration, audit and ledger transition. Coverage retains issued policy-version, price, discount and service snapshots; catalog, class, service, policy or assignment changes require authorized correction/refund review rather than automatic conversion. Parent has no policy, assignment, refund or payment mutation. High-impact cookie mutations, including School provisioning, require origin validation, double-submit CSRF, idempotency and Operation reconciliation.
- Parent authorization derives only from active StudentParent links, applies retention server-side, exposes minimum DTOs and never caches protected responses or journal media in the service worker. Teacher authorization additionally requires active Staff binding, capability and effective Class assignment.
- Payroll is server-enforced as a per-School opt-in entitlement `NOT_ENTITLED | PILOT_ENABLED | ENABLED | SUSPENDED | RETIRED`; it does not grant roles and gates Payroll/workforce/timekeeping routes and jobs. Suspension/retirement preserves historical data and cannot bypass unresolved payroll work.
- “Accountant”/“Kế toán” is a product persona resolved from an active same-School `FINANCE_MANAGER` grant, Payroll entitlement and the capability required by the concrete action; no `ACCOUNTANT` preset role exists. Missing entitlement or capability denies route/job/action server-side before record lookup and prevents Payroll data/navigation disclosure.
- Payroll separation of duties compares resolved UserIdentity, not role labels: an identity that prepared/materially edited or submitted a run/correction cannot approve/refuse it through another membership/grant. Only an eligible different-identity `SCHOOL_ADMIN` with `PAYROLL_APPROVE` may approve/refuse; only `SCHOOL_ADMIN` with `PAYROLL_REOPEN` may reopen an approved unpaid run; only `FINANCE_MANAGER` with `PAYROLL_PAYOUT_CONFIRM` may confirm payout after approval.
- Payroll is independent from Student receivables: it uses its own periods, versions, payouts and corrections; API calculates VND `BIGINT` through typed, code-owned, effective-dated policy schemas and snapshots source facts. User-authored formulas/scripts are forbidden.
- Tenant isolation, revoke, ledger concurrency/idempotency and Parent cross-School behavior are pilot release gates. The VPS pilot builds from source without a registry or backup; production recovery, performance, rate-limit and cloud decisions require a Spine update before public/operational rollout.

## Non-goals

- Compatibility layers, dual legacy schema/finance lifecycle, or production migration as part of this clean-break.
- Bank synchronization, webhooks, virtual accounts or Parent payment confirmation.
- VAT calculation, custom-role UI, Organization hierarchy, custom School domains, JIT support access or live shared catalogs.
- Chat, SMS/Zalo/email, free-form albums, meal journals, medical/medication, transport, pickup authorization, generic import/export, direct timeclock/vendor integration, tax/BHXH filing integration or certified legal-compliance claims. Daily journals per Student/date and the scoped Payroll file import are in scope.
- Automatic pricing from attendance/handover/service enrollment, automatic late-pickup fees, or Parent finance/service-cancellation mutations.
- An independent Student Prepayment balance, excess Receipt posting, or applying a generic balance to a future Invoice.

## Success signal

- Every release passes the mandatory cross-tenant authorization suite; CollectionRun generation and finance report fixtures reconcile without duplicate posting.
- In a 30-day pilot, at least 90% of School setup fixtures complete without technical intervention, at least 95% of issued Invoices reconcile to the ledger, and no confirmed tenant leak or duplicate finance posting occurs.
- Every anonymized Payroll fixture reconciles each calculated component against approved Excel input/output; the integration suite proves no duplicate Payroll calculation, approval, payout or correction after retry.

## Assumptions

- Parent finance MVP presents read-only snapshot Payment instructions. VietQR, payment-field copy and bank deep links are separately gated enhancements.

## Open Questions

- When public or operational production rollout is planned, which registry, reverse proxy, backup/restore, monitoring, SLO, rate-limit and cloud-provider design will be adopted?
