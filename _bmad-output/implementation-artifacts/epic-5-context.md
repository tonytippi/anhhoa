# Epic 5 Context: Tạo và phát hành nghĩa vụ thu

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable Finance Managers and authorized School Admins to configure a School-scoped receivable catalog, create monthly CollectionRuns, review the server-authoritative eligible-student preview, generate populated Invoice DRAFTs without duplicates, make audited per-student exceptions, and issue immutable payment obligations. This establishes a trustworthy Finance Admin foundation before receipt, settlement, carry, reporting, Parent payment views, or operational automatic charging are introduced; it also adds the phase-1b promotion policy path so issued obligations preserve the evaluated discount facts.

## Stories

- Story 5.1: Quản lý receivable catalog theo School
- Story 5.2: Tạo CollectionRun và server-authoritative preview
- Story 5.3: Generate Invoice DRAFT rỗng idempotent theo snapshot roster
- Story 5.4: Rà soát dòng Invoice DRAFT có audit
- Story 5.5: Issue Invoice với Payment instruction snapshot bất biến
- Story 5.6: Release gate Finance Admin MVP
- Story 5.7: Đóng CollectionRun đã generate
- Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ
- Story 5.9: Cấu hình template khoản thu cho Đợt thu
- Story 5.10: Generate Invoice DRAFT có dòng template
- Story 5.11: Release gate template Đợt thu
- Story 5.12: Cấu hình ưu đãi theo khoản thu và gán học sinh
- Story 5.13: Preview và generate ưu đãi authoritative
- Story 5.14: Recheck Issue và snapshot ưu đãi bất biến
- Story 5.15: Release gate ưu đãi theo khoản thu Pha 1b
- Story 5.16: Finance table-first catalog và giảm trừ
- Story 5.17: Đợt thu table-first và rà soát Draft tuần tự

## Requirements & Constraints

- Finance catalog records, runs, templates, promotion policy data, Invoice records, audit, and Operations are scoped to the authorized School. Inactive catalog items remain readable in historical snapshots but cannot be used for new DRAFT content.
- The initial run type is monthly only. `billingMonth` uses `YYYY-MM`, and a SchoolYear has at most one CollectionRun for that month. Only `ENROLLED` students are eligible by default.
- A CollectionRun lifecycle is `DRAFT -> READY -> GENERATED -> CLOSED`. Student selection and template mutation are permitted only in DRAFT. Preview must use the same selection outcome as generate and return selected/eligible students plus categorized skips. Stale or invalid preview results cannot generate.
- A DRAFT run requires a non-empty common template. Each Receivable occurs at most once, has a positive integer quantity, and uses the catalog default price. The server derives VND amount and total; browsers never submit price, amount, total, eligibility, scope, or ordering. Template output is amount-descending with a stable server tie-breaker.
- Generate creates at most one populated DRAFT Invoice per eligible Student/run and snapshots roster, template, Receivable, unit, quantity, default price, amount, and applicable promotion facts atomically. After GENERATED, an eligible Student without an Invoice may receive exactly one DRAFT using the immutable run snapshot, never live catalog/template data.
- Finance may add, edit, or remove active same-School catalog lines only while an Invoice is DRAFT. Quantity and price are whole, positive VND values. Price overrides and explanatory manual Finance-source references require reason, audit, timestamp, actor, and provenance; references never calculate a fee, price, discount, or total.
- Issue requires an active same-School BankAccount and a confirmed idempotent command. It snapshots the obligation, roster/source facts, receiving bank, account number, account holder, transfer content, student code, class name, and issued total. Issued content, Payment instruction, lines, totals, discount, and BankAccount cannot be changed.
- Issued correction uses a replacement DRAFT with immutable source facts, same-School/Student/run revision lineage, and audit. Issuing the replacement atomically cancels the source without overwriting records. Parent-effective projection is the replacement only; internal correction and settlement-transfer provenance are not exposed.
- Promotion policies are School-scoped, effective-dated, and target same-School Receivables. Student assignments use effective intervals, reason, audit, and explicit assignment rather than inferred family relationships. The server evaluates per-line gross, discount, and net during preview/generate, then re-evaluates inside issue; changed facts require renewed review. Fixed-VND applies before percentage; priority, exclusivity, and stable ordering are deterministic; discount cannot exceed gross or create a negative line, generic credit, or balance.
- Every high-impact finance mutation uses a UUID `Idempotency-Key`, transaction, School-scoped Operation, fingerprint, and audit. Identical retries replay the saved outcome; a changed fingerprint conflicts. After timeout, clients reconcile `GET /operations/:operationId` before retry.
- VND persists as PostgreSQL `BIGINT` and crosses REST only as JSON-safe integers. The API exclusively owns authorization, calculations, transitions, eligibility, snapshots, and state; no client-derived finance authority is permitted.
- Release proof must cover tenant isolation, scoped uniqueness, lifecycle locks, stale preview rejection, snapshot immutability, integer calculations, idempotency, retry/concurrency, cross-School graph rejection, and issue restrictions. Generate for 200 students in the target-school fixture must expose Operation progress and complete within 30 seconds.
- Receipt, actual-receipt outcome, carry, settlement KPI, debt, refund, report, `PREPAID_COVERAGE`, coverage issuance, service enrollment, ChargeRule automation, attendance/Teacher dependencies, Parent dependencies, and Payroll are outside the Finance Admin MVP and promotion phase scope.

## Technical Decisions

- `finance` owns ReceivableGroup, Receivable, CollectionRun, CollectionRunTemplateLine, Invoice, promotion policies/targets/assignments, evaluation snapshots, and their write boundaries. The API uses narrow module contracts rather than portal or cross-module internals.
- Every School business query and mutation resolves active server-side School membership and capability per request; route IDs, UUIDs, filters, headers, and browser state are selectors, not authorization evidence. `FINANCE_MANAGE` is the dedicated capability for the catalog, monthly run template, DRAFT line, and issue commands.
- Use PostgreSQL transactions for template changes, generate, issue, revision/cancellation, and other multi-record state changes. Enforce one Invoice per `(schoolId, studentId, collectionRunId)`, with the audited replacement exception for a cancelled source.
- Finance consumes a roster-owned as-of snapshot during generate and persists the facts it needs. Live roster, catalog, BankAccount, policy, target, assignment, or template changes never rewrite generated or issued history.
- Cookie-auth mutations require origin validation and double-submit CSRF in addition to capability, lifecycle, tenant-graph, and idempotency validation.
- Story 5.3 is historical empty-DRAFT delivery and has been superseded by template configuration and populated-DRAFT generation in Stories 5.9 and 5.10. Do not reintroduce empty-DRAFT generation.

## UX & Interaction Patterns

- `Khoản thu`, `Giảm trừ`, and `Đợt thu` are desktop-first, table-first Admin destinations: concise Vietnamese columns, server-backed search/filter/sort/pagination where applicable, text status, and a final `Tùy chọn` row menu. Create, lifecycle, assignment, and other bounded impactful actions open a single accessible dialog rather than an inline form.
- `Đợt thu` begins with a monthly-run list. The create dialog clearly distinguishes creating a run from opening the existing run for that month. Run detail contains template, Student, and Invoice tables; preview and generate display only server-returned values, skips, and lifecycle availability.
- Invoice review is a dedicated Student/Invoice destination reached from a run. It keeps the originating server-authorized list/query/order and shows previous/next Student actions only when the adjacent Invoice remains authorized. After save or issue, show the terminal result before the user deliberately chooses the next Invoice; never auto-jump.
- Show the selected School and period prominently. Amounts are right-aligned whole VND; Finance surfaces remain sober, readable, and non-childlike. State and lifecycle restrictions use text labels and server explanations, not client-side overrides.
- Dirty forms and pending or uncertain mutations block School switching with remain, discard-before-submit, or Operation reconciliation. Dialogs trap and restore focus; financial, destructive, discard, and issue actions use named confirmation. Retain input on validation error, focus an accessible error summary, and clear stale School data on revoke or denied context.

## Cross-Story Dependencies

- Epic 1 supplies tenant isolation, School context, staff capability authorization, cookie mutation protection, audit, idempotent Operations, and reconciliation.
- Epic 2 supplies SchoolYear, Student, enrollment lifecycle, class facts, and roster snapshots; Epic 3 supplies FinancePolicy and active BankAccount lifecycle/snapshots.
- Stories 5.1 and 5.2 establish catalog/run prerequisites. Stories 5.9 and 5.10 supersede the empty-DRAFT path and gate the current generate behavior. Story 5.4 reviews per-Invoice exceptions; Story 5.5 issues the obligation; Story 5.7 closes fully reviewed runs; Story 5.8 handles issued-content correction.
- Promotion Stories 5.12-5.15 follow the template gate and feed preview, generate, and issue recheck without introducing settlement or coverage behavior. Stories 5.6, 5.11, and 5.15 are release gates for their respective contracts.
- Epic 6 depends on issued obligations from this epic for receipt, settlement, carry, refund, debt, reports, and coverage. Epic 4 may later provide immutable operational sources for finance adjustments but must not alter this epic's manual snapshot, run, or issued-obligation contracts.
