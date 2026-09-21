# Epic 5 Context: Tạo và phát hành nghĩa vụ thu

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the Finance Admin MVP so authorized Finance users can maintain a School-scoped receivable catalog, select eligible Students in a monthly CollectionRun, generate one empty DRAFT Invoice per Student without duplicates, review Finance-selected lines, and issue an immutable obligation and Payment instruction snapshot. This enables Schools to issue reliable tuition obligations before operational, Parent, settlement, promotion, and reporting enhancements exist.

## Stories

- Story 5.1: Quản lý receivable catalog theo School
- Story 5.2: Tạo CollectionRun và server-authoritative preview
- Story 5.3: Generate Invoice DRAFT rỗng idempotent theo snapshot roster
- Story 5.4: Rà soát dòng Invoice DRAFT có audit
- Story 5.5: Issue Invoice với Payment instruction snapshot bất biến
- Story 5.6: Release gate Finance Admin MVP
- Story 5.7: Đóng CollectionRun đã generate
- Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ

## Requirements & Constraints

- Finance Admin MVP is limited to the active/inactive ReceivableGroup and Receivable catalog, monthly CollectionRuns, empty DRAFT generation, manual DRAFT-line review, and Invoice issue. ChargeRule automation, service enrollment, leave adjustment materialization, PromotionPolicy, `PREPAID_COVERAGE`, receipts, carry, debt, reports, and Parent/Teacher flows are deferred. Do not introduce their routes, persistence, bundles, or authorization dependencies.
- `FINANCE_MANAGE` must be resolved server-side from the active same-School StaffProfile, primary SchoolPosition, membership login binding, and capability. Every record, query, mutation, unique constraint, audit record, and Operation is School-scoped; client School context, IDs, filters, headers, capabilities, and browser state are not authorization evidence.
- Catalog records are School-scoped and auditable. An inactive Receivable cannot be selected for a new DRAFT line but remains readable through historical snapshots. An optional receivable code is unique within its School.
- The initial CollectionRun type is only `MONTHLY`, with required `billingMonth` in `YYYY-MM`; a SchoolYear has one run per billing month and opening an existing month reopens that run rather than creating another. Lifecycle is `DRAFT -> READY -> GENERATED -> CLOSED`; Student selection is editable only in DRAFT, preview must be accepted before generate, GENERATED locks generated Students, and CLOSED prevents create/edit.
- Preview and generate use the same server selection policy. Preview returns authorized selected/eligible Students and categorized skips; the browser must not derive eligibility, skip reasons, Receivable lines, or totals. Generate uses a roster as-of snapshot and persists enrollment/class/source facts needed for history.
- A Student normally has at most one Invoice per `(schoolId, studentId, collectionRunId)`. Generate creates at most one empty DRAFT Invoice for each eligible selected Student, reports created/skipped outcomes, and only permits adding an eligible Student without an Invoice after GENERATED. Do not create supplemental runs or add charges to issued Invoices.
- A DRAFT line selects an active same-School Receivable, has a strictly positive integer quantity, and uses its positive default VND unit price or an authorized, audited override. The API derives every line amount and Invoice total. Reject zero, negative, fractional, float, non-JSON-safe, or client-supplied money/total/status values; removing a line means the receivable does not apply.
- Finance may attach an explanatory manual Finance-source snapshot to a same-School Student's DRAFT line: optional service date, attendance status, picked-up time, and/or late-care minutes, with mandatory reason, actor, timestamp, and provenance. Validate tenant graph, StudentEnrollment, business date, DRAFT state, and whole-VND quantity/unit price. This input never calculates quantity, price, fee, discount, or total, and it becomes immutable at issue.
- Issue requires one active BankAccount from the same School. The transaction snapshots the server-calculated obligation lines/total, roster facts, receiving bank, account number, account holder, validated transfer content, Student code, and class name. Issued content, BankAccount selection, and Payment instruction are immutable; only later settlement or revision workflows may transition the Invoice. The browser and Parent cannot set outstanding, settlement outcome, payment status, or cancellation.
- VND persists as PostgreSQL `BIGINT` and crosses REST only as JSON-safe integers. Finance state changes use transactions; DRAFT-line mutation, generate, issue, close, and revision require a UUID `Idempotency-Key`, School-scoped Operation, request fingerprint, audit/provenance, replay of identical retries, and conflict for changed-key reuse. After timeout, reconcile `GET /operations/:operationId` before retry.
- The release gate must prove tenant graph isolation, catalog lifecycle, shared preview/generate outcomes, roster snapshots, lifecycle locks, positive integer VND math, rejection of client total/status injection and wrong/inactive BankAccounts, issued-snapshot immutability, retry/concurrency safety, and observable Operation progress with 1,000 Students completing generate within 60 seconds.

## Technical Decisions

- The API `finance` domain owns CollectionRun, Invoice, calculations, lifecycle transitions, snapshots, audit, and Operations. Portals call REST only; controllers call their owning service and cross-domain data is obtained through narrow contracts rather than direct aggregate access.
- Validate the complete same-School graph in the transaction, using composite `(schoolId, id)` relations where supported and explicit owning-command validation otherwise. Roster supplies an as-of snapshot; current roster, catalog, policy, or BankAccount updates must not rewrite issued history.
- Use the School business timezone `Asia/Ho_Chi_Minh`. SchoolYear is the finance boundary; maintain immutable facts rather than mutable current-state references where an Invoice or run requires historical accuracy.
- Cookie-authenticated mutations require origin validation and double-submit CSRF in addition to capability checks. Operations authorize reads only to the same actor context that created them.
- Story 5.7 closes a GENERATED run only when every Invoice is `ISSUED`, `CLOSED`, or `CANCELLED`; it records reason/audit and locks the run. Story 5.8 is a later settlement-release workflow: prepare one same-School/Student/run replacement DRAFT from an issued source, preserve immutable lineage, then atomically issue the replacement and change the source to `CANCELLED`. Confirmed receipts are never rewritten; any transfer provenance is append-only.

## UX & Interaction Patterns

- Finance is an Admin portal, desktop-first, table-first workspace. The CollectionRun landing is a compact filtered list with create action; run detail is a Student eligibility/status table. Invoice review is a contextual deep destination entered from a selected Student/Invoice, not a sidebar destination.
- Keep the selected School and period visible. Show server-returned VND values right-aligned as whole VND and lifecycle states as text labels. Do not show zero-value lines, automatic-fee suggestions, client-estimated totals, or local lifecycle overrides.
- The CollectionRun wizard follows edit -> server preview -> named generate confirmation -> Operation reconciliation. DRAFT review supports add/edit/remove line, active BankAccount choice, and explanatory manual reference with audit reason; issued detail is read-only and shows the immutable obligation and Payment instruction snapshot.
- On dirty context changes, offer remain, discard before submit, or Operation reconciliation; never autosave. On validation failure, retain input, focus an error summary, and show field errors. On timeout, disable duplicate submission and fetch the Operation result before offering retry. Cold loads, revoke, and permission denial must not expose stale data from another School.
- Use named confirmation and focus-managed dialogs for issue, close, revision, and destructive actions. Tables need captions, keyboard row actions, responsive cards or horizontal scrolling, and WCAG 2.1 AA behavior.

## Cross-Story Dependencies

- Epic 5 depends on Epic 1 tenant isolation, authorization, CSRF/idempotency/Operation infrastructure; Epic 2 SchoolYear, Class, StudentEnrollment, Student code, and roster snapshots; and Epic 3 FinancePolicy and active BankAccount lifecycle.
- Stories 5.2 and 5.3 share the authoritative Student-selection policy and roster snapshot boundary. Story 5.4 depends on generated DRAFT Invoices and the catalog from 5.1; Story 5.5 depends on reviewed DRAFT lines and BankAccounts. Story 5.6 verifies the whole MVP slice.
- Stories 5.7 and 5.8 belong with the Finance settlement release alongside Epic 6. Their settlement, receipt, correction-transfer, promotion, and reporting behavior must not be pulled into the MVP implementation.
- Epic 4 is not an MVP dependency. Later immutable operational facts can support Finance-owned adjustments, but cannot overwrite or re-price manual Finance-source snapshots already issued.
