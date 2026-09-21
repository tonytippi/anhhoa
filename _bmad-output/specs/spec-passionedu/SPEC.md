---
id: SPEC-passionedu
updated: 2026-09-16
companions:
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md
  - ../../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/payroll-module-roadmap-2026-09-08.md
sources:
  - ../../planning-artifacts/sprint-change-proposal-2026-08-31.md
  - ../../planning-artifacts/sprint-change-proposal-2026-09-16.md
  - ../../planning-artifacts/sprint-change-proposal-2026-09-16-finance-reporting.md
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
  - **intent:** Finance Admin MVP users can configure School-scoped receivables and effective-dated `FIXED`/`MANUAL` ChargeRules, review authoritative monthly CollectionRun previews, create draft obligations for eligible Students, and issue snapshot obligations without Teacher or Parent portals.
  - **success:** A Student has at most one Invoice in a CollectionRun; generation reconciles through its Operation and never duplicates an Invoice after retry or timeout. Roster/rule evaluation and Payment instruction are server snapshots. A Finance Manager or School Admin may add an audited manual Finance-source reference for attendance/late-care to a DRAFT line, but the API never derives quantity, price, fee, discount or total from it; issued snapshots remain immutable.
- **CAP-5**
  - **intent:** Finance users can issue snapshot obligations, close them against actual receipts, carry the resulting shortage/excess into the next run, correct issued Invoice content, and maintain promotion coverage, reversals, refunds, debt and reports through a ledger.
  - **success:** A normal Invoice closes once with its actual VND Receipt and derives `EXACT`, `SHORTFALL` or `OVERPAYMENT`; a non-exact result has one immutable source-linked difference that only a later same-Student/School/SchoolYear MONTHLY run materializes as a bounded carry adjustment. Issued-content correction creates an audited replacement and cancels the source without history mutation. An Invoice containing `PREPAID_COVERAGE` facts must close `EXACT` before coverage issues. Four authorized Finance reporting workspaces reconcile gross, promotion discount/refund, actual receipt, open/materialized difference, carry, revision lineage, coverage and outstanding at an explicit server `asOf`; authorized CSV extracts exactly the same server result and metadata.
- **CAP-6**
  - **intent:** Teachers can manage attendance, handover and daily journals only for effective assigned Classes; authorized users can manage leave and services under School policy, supplying Finance with controlled adjustment references.
  - **success:** Unauthorized writes are denied; holiday and confirmed-PRESENT leave conflicts are excluded from meal adjustments; REQUIRED attendance or handover evidence blocks the corresponding PRESENT or picked-up-time write without an image, remains Teacher/Admin-only, and its blob is deleted after two calendar months. A daily journal has audited same-day versions and authorized JPEG/PNG/WebP media at most 10 MB each; Finance creates only source-linked idempotent adjustments, never automatic charges.
- **CAP-7**
  - **intent:** Parents can use a multi-School portal to view authorized daily attendance, daily journals and media, obligations and snapshot payment instructions for their children, and submit only permitted leave requests.
  - **success:** Parent sees only their authorized Student's `PRESENT`, `ABSENT`, `ON_LEAVE` or clearly non-absent `NOT_RECORDED` status, confirmed picked-up time and current journal within operational retention; Staff identity, internal reasons, attendance/handover evidence and journal audit stay hidden; logout, expiry and revoke clear protected client state; Parents cannot mutate attendance, handover, journal or finance activity.
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
- `PREPAID_COVERAGE` is a PromotionPolicy fulfillment mode within a normal `MONTHLY` CollectionRun. After direct agreement, a Finance Manager or School Admin, not a Parent, selects an eligible policy version for one or more Students while reviewing the server-authoritative preview; the start period is that run's `billingMonth`. The one DRAFT Invoice per selected Student contains the covered future receivable-period facts and may include non-covered Receivables of the open billing month, but never unrelated future charges. Coverage issues only when that Invoice closes `EXACT`; the API owns coverage overlap validation, ordinary-run exclusion, proration, audit and ledger transition. Coverage retains issued policy-version, price, discount and service snapshots; catalog, class, service, policy or assignment changes require authorized correction/refund review rather than automatic conversion. Parent has no policy, assignment, refund or payment mutation. High-impact cookie mutations, including School provisioning, require origin validation, double-submit CSRF, idempotency and Operation reconciliation.
- Normal receipt close is one Invoice at a time and records the actual VND amount server-side. A non-exact close appends a source-linked SettlementDifference; only the next eligible same-Student, same-School, same-SchoolYear MONTHLY DRAFT may apply its remaining amount as a bounded positive/negative carry. There is no generic credit, independent Student prepayment, unallocated Receipt or cross-tenant/year carry. An issued correction creates a replacement Invoice and atomically marks the source `CANCELLED`; a confirmed source Receipt reaches the replacement solely through append-only settlement-transfer provenance. Parent sees only the effective Invoice and cannot mutate finance.
- Finance reports are read-only API projections scoped and authorized by School membership. Each response declares `asOf`, `generatedAt`, `Asia/Ho_Chi_Minh` business timezone, applied filter and definition version; it includes only posted ledger events through `asOf`, groups billed measures by Invoice `billingMonth` and cash measures by event posting time. Reversal/refund remains at posting time with source provenance; revision/cancellation remains auditable while only current-effective obligations contribute to obligation totals. Finance Manager/SCHOOL_ADMIN CSV export is server-generated from that exact result, re-authorized at download, expiring and audited. Period close/reopen, scheduled/custom reports, PDF/XLSX and Payroll reporting are not in this capability.
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
- An independent Student Prepayment/generic balance, unallocated Receipt, cross-Student/School/SchoolYear carry, or direct client application of a settlement difference.

## Success signal

- Every release passes the mandatory cross-tenant authorization suite; CollectionRun generation and finance report fixtures reconcile without duplicate posting.
- In a 30-day pilot, at least 90% of School setup fixtures complete without technical intervention, at least 95% of issued Invoices reconcile to the ledger, and no confirmed tenant leak or duplicate finance posting occurs.
- Every anonymized Payroll fixture reconciles each calculated component against approved Excel input/output; the integration suite proves no duplicate Payroll calculation, approval, payout or correction after retry.

## Assumptions

- Parent finance MVP presents read-only snapshot Payment instructions. VietQR, payment-field copy and bank deep links are separately gated enhancements.

## Open Questions

- When public or operational production rollout is planned, which registry, reverse proxy, backup/restore, monitoring, SLO, rate-limit and cloud-provider design will be adopted?
