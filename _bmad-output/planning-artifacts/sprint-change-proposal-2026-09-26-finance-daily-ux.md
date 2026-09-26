---
name: Finance daily-work UX remediation
status: approved
date: 2026-09-26
trigger: Post-Epic-6 UX review found the Admin Finance implementation safe for finance mutations but not practical for a ke toan's repeated daily work. The current single long form-first workspace lacks table-first destinations, row action menus, a receipt queue, and sequential Draft-Invoice review.
mode: batch
---

# Sprint Change Proposal - Finance daily-work UX remediation

## 1. Issue summary

Epic 5 and Epic 6 delivered the Finance domain, its server-authoritative money and lifecycle rules, idempotent Operations, and the Admin controls required to create, issue, settle, correct and report on Invoices. The post-completion UX review found that the Admin UI exposes these controls as one long form-first page. It is technically safe but inefficient for a ke toan who repeatedly works through catalog rows, monthly runs, Draft Invoices and issued Invoices each day.

Concrete findings from the review:

1. `FinanceWorkspace` opens with large configuration forms before its management tables; it does not provide separate table-first destinations for Khoan thu, Giam tru, Dot thu and Thu tien.
2. Finance rows render direct text buttons rather than the established `...` row menu used in the student-management workspace.
3. A user reviewing or issuing a Draft Invoice cannot move to the previous or next Student in the current run/list context.
4. Receipt posting is reachable only through a CollectionRun/Invoice-detail path. There is no searchable, filterable and paginated `ISSUED` Invoice queue for daily collection work.
5. Important catalog, promotion, template and Draft-line mutations do not consistently use a review/confirmation dialog.
6. Several confirmation dialogs do not consistently trap focus and restore it to their trigger.

This is a stakeholder-driven UX requirement that clarifies the daily operating model. It is not a defect in the Finance ledger model and does not change money calculation, authorization, state transitions, snapshots, audit, idempotency or Operation reconciliation.

## 2. Impact analysis

| Area | Impact |
| --- | --- |
| Epic 5 | Its completed catalog, CollectionRun, Draft review and issue capabilities gain post-completion UX remediation stories. Historical stories and their acceptance evidence stay unchanged. |
| Epic 6 | Its completed receipt/carry/revision/report capabilities gain a daily `Thu tien` queue and sequential review UX. Ledger and settlement contracts stay unchanged. |
| Future epics | Epic 7 Parent finance remains read-only and unaffected. Epic 8-11 Payroll must not inherit Finance navigation or Invoice/Receipt read models. |
| PRD | No product, money or authorization requirement changes. UJ-3 needs an explicit daily-work UX outcome only if the proposal is approved. |
| SPEC | CAP-4/CAP-5 and constraints remain valid. The only additional delivery contract is a server-authorized, paginated Invoice list projection for Finance UI navigation. |
| Architecture Spine | AD-2, AD-3, AD-7, AD-8 and AD-11 remain valid. A Finance-owned read query may accept filters/cursor only as selectors after same-School capability authorization; it never trusts `schoolId`, status, cursor or client order as authorization. |
| UX spine | Requires updates to Information Architecture, Finance component patterns, Flow 2/2c, Interaction Primitives and accessibility rules. |
| Mockups | Finance mockups need revision before implementation: receivable configuration, promotion, CollectionRun, Invoice review, and a new receipt queue mockup. |
| Admin application | `FinanceWorkspace` must be split or internally routed into focused workspaces; row-menu, dialog and list-query patterns should be shared rather than duplicated. |
| API and data | No ledger migration is proposed. Add a Finance list/read projection for Invoice queues only if the current CollectionRun list cannot return server-authorized filter/pagination/order data. |
| Verification | Add UI, API unit/controller, PostgreSQL authorization and Admin E2E coverage for list filters, cursor/order, row menus, confirmations, focus behavior, Draft next/previous and receipt-next flows. |

### Invariants preserved

1. `School` remains the tenant root and every Finance query, Operation and audit remains School-scoped.
2. The API alone authorizes capabilities and derives VND values, Invoice lifecycle, Receipt outcome, Difference, carry, coverage, correction and report values.
3. A Receipt still closes exactly one `ISSUED` Invoice; the browser cannot allocate, calculate or select carry.
4. All high-impact mutations retain origin validation, double-submit CSRF, UUID `Idempotency-Key`, Operation reconciliation and audit requirements.
5. Parent remains read-only and receives no Finance back-office queue, row action, receipt or ledger data.

## 3. Recommended approach

**Selected approach: Direct backlog adjustment with UX-first remediation.**

Create four follow-up stories under the existing Finance epics. Update the UX spine and approved mockups first, then update Epic traceability and tracker, then implement in independently testable vertical slices. Do not rewrite completed Epic 5/6 stories, revert ledger code, or introduce client-side finance authority.

**Scope classification:** Moderate.

**Effort:** Medium-high. The work is concentrated in the Admin Finance UI and a narrow Finance read projection, but it touches navigation, accessibility, pagination/query semantics and substantial E2E coverage.

**Risk:** Medium. The main risks are applying a client-derived next item after filters change, leaking cross-School Invoice information through a list query, and duplicating inaccessible menu/dialog behavior. The mitigations are server-authorized filters/cursor, deterministic server order, same-School reauthorization for every detail/action request, reuse of the roster menu behavior, and explicit keyboard/focus tests.

### Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Small CSS/content cleanup on current Finance page | Rejected | Does not create a receipt queue, preserve list context, or make high-volume daily tasks fast. |
| Rewrite all Epic 5/6 code or revert completed work | Rejected | Domain behavior is correct and already verified; only the presentation/read-workflow layer needs remediation. |
| Browser-sort all loaded Invoice rows and derive Next locally | Rejected | It is incomplete for paginated data and can become stale after a mutation or filter change. |
| Separate table-first Finance workspaces backed by server-authorized list projections | Selected | Matches the reviewed operating model while preserving the API authority and existing Finance aggregate boundaries. |

## 4. Detailed change proposals

### 4.1 UX spine and navigation

**Files:** `ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md`, `DESIGN.md` only if a shared row-menu/dialog primitive needs documented styling, `MOCKUP-COVERAGE.md`.

**OLD:** Finance information architecture names `Khoan thu / Uu dai / Dot thu` and `Thu tien / Cong no / Bao cao`, but does not define daily table-first list behavior, a receipt queue, row menus, or sequential Invoice navigation.

**NEW:**

```md
Finance has focused Admin destinations: Khoan thu, Giam tru, Dot thu, Thu tien,
Cong no and Bao cao. Comparable records open as table-first lists with concise
filters, server-authorized search/sort/pagination, and a final Tuy chon row menu.
Create and important mutations open a single accessible dialog with a clear
server-confirmed consequence; forms do not precede the default list surface.

Thu tien defaults to a server-authorized list of ISSUED Invoices for the visible
School. Finance can filter by SchoolYear, billing month, Class, Student code/name
and permitted status, open one Invoice, enter actual VND and confirm Receipt.
After the Operation is confirmed, the result shows server-returned outcome and
provides a next eligible list item without posting another Receipt automatically.

Draft Invoice review preserves the originating CollectionRun/list query and its
server order. It provides Hoc sinh truoc / Hoc sinh tiep theo when such items
exist. After saving a Draft change or issuing, the user sees the confirmed result
then may explicitly open the next item; a changed filter, stale cursor or denied
record reloads the authoritative list rather than guessing a next Invoice.
```

**Required interaction rules:**

1. Every Finance management table uses concise Vietnamese headings, visible School context, status text, search/filter/sort where relevant, explicit pagination and a `Tuy chon` action column.
2. The `...` row menu follows the roster menu keyboard behavior: Enter/Space/Arrow opens, arrow keys move menu items, Escape closes and restores focus, Tab/blur closes.
3. Only actions permitted by the server-returned state appear. The browser does not infer a Finance lifecycle transition.
4. Create, lifecycle, template, Draft monetary change, issue, receipt, correction, reversal/refund and discard actions use one non-stacking dialog. The dialog has a focus trap, one obvious dismiss path and focus restoration.
5. Invoice line source/audit/provenance remains behind a disclosure or protected detail view, not in the normal table row.
6. Desktop retains dense tables; tablet/mobile retain identifying columns through horizontal scroll or responsive cards, with the row action reachable.

### 4.2 Mockup changes

**Files:**

1. `mockups/admin/receivable-configuration.html`
2. `mockups/admin/invoice-generation.html`
3. `mockups/admin/invoice-detail-review.html`
4. New `mockups/admin/receipt-queue.html`
5. `mockups/admin/finance-style.css`
6. `MOCKUP-COVERAGE.md`

**Required screens and flow:**

1. `Khoan thu`: default catalog table, short filters and `Them khoan thu` CTA. Create/edit/lifecycle is in a dialog. Each row ends in `...`.
2. `Giam tru`: policy-version table first; opening a row reveals its assignment table. Create version, activate/retire, batch assignment and end assignment are dialog-driven row actions.
3. `Dot thu`: monthly run table first; `Tao dot thu` uses the reviewed modal. Run detail preserves template, Student and Invoice tables; all actions use final-column menus.
4. `Draft Invoice review`: contextual title contains run, Student and class; invoice-line table is primary. It has a compact action bar with `Hoc sinh truoc`, `Hoc sinh tiep theo`, and state-appropriate actions. `Phat hanh va hoc sinh tiep theo` is available only after the user has confirmed the issue result and a next Draft exists.
5. `Thu tien`: defaults to the `ISSUED` Invoice table; each row shows Student, class, billing month, obligation/outstanding and status. The row menu opens detail or `Ghi thuc nhan`. The receipt modal shows only server-returned amount/context and requires confirmation. The success state shows exact/shortfall/overpayment and a deliberate `Hoa don tiep theo` action.

### 4.3 Narrow API read-model addition

**Affected module:** `apps/api/src/modules/finance`.

**New read contract, if absent after implementation discovery:**

```text
GET /api/app/schools/:schoolId/finance/invoices
  ?state=ISSUED|DRAFT
  &schoolYearId=<uuid>
  &billingMonth=YYYY-MM
  &className=<text>
  &q=<student-code-or-name>
  &sort=<approved-server-sort>
  &cursor=<opaque-server-cursor>
  &pageSize=<bounded-integer>

Response: { data: { rows: InvoiceQueueRow[], nextCursor, total? } }
```

`InvoiceQueueRow` is a minimum Finance DTO: Invoice ID, state, Student code/name, class snapshot, SchoolYear/billing month, server-returned obligation/outstanding and current receipt summary where permitted. It does not expose Parent DTOs, raw audit identifiers, opaque provenance or client-calculated values.

The query must reauthorize `FINANCE_MANAGE` and selected School before lookup, scope every filter/cursor to that School, reject malformed/foreign cursors, bound page size, and use a stable server order. Detail, receipt and next/previous navigation reauthorize each Invoice by the current School/capability. A mutation result invalidates/reloads the originating list; it never relies on a stale browser array.

### 4.4 Follow-up stories

#### Story 5.16: Finance table-first catalog and promotion workspaces

As a Finance Manager, I want to manage Khoan thu and Giam tru from compact tables with row menus and dialog-confirmed actions, so that I can find and change daily finance configuration quickly without scanning large forms.

**Acceptance criteria:**

1. Given an authorized Finance user opens Khoan thu or Giam tru for a visible School, when the route loads, then its primary surface is a server-backed table with concise columns, text statuses, appropriate search/filter/sort/pagination and a final `Tuy chon` menu; no create/edit form precedes the list.
2. Given a row action is selected, when it creates, changes lifecycle, activates/retires a promotion version, assigns/ends an assignment, or changes another important Finance record, then one accessible confirmation dialog names the record and impact, preserves input/errors, traps focus, restores focus and refreshes the server result only after the Operation completes.
3. Given an action is unavailable under server-returned state/capability, when the table renders, then that menu item is absent and no client lifecycle inference or optimistic status is shown.
4. Given keyboard-only use, when the row menu/dialog is opened or dismissed, then its behavior matches the established roster action menu and accessibility-floor requirements.

#### Story 5.17: Table-first CollectionRun and sequential Draft Invoice review

As a Finance Manager, I want to create and work through monthly runs and Draft Invoices from contextual tables, so that I can review and issue successive Students without repeatedly returning to and searching a list.

**Acceptance criteria:**

1. Given Finance opens Dot thu, when no run is selected, then the primary surface is a filterable/paginated monthly run table and `Tao dot thu` opens a named confirmation dialog that distinguishes opening an existing run from creating one.
2. Given a selected run, when Finance edits a template, selection, generated-Student addition or run lifecycle, then the action originates from a row menu or contextual CTA and important mutations use accessible confirmation dialogs without weakening existing preview, fingerprint, Operation or lifecycle locks.
3. Given Finance opens a Draft Invoice from an ordered run/list, when the Invoice detail renders, then it preserves the originating query/order and exposes `Hoc sinh truoc` and `Hoc sinh tiep theo` only for server-authorized adjacent items.
4. Given Finance saves a Draft line or issues an Invoice, when the server returns the confirmed outcome, then the UI presents the result before offering an explicit next Draft action; it never auto-opens another Invoice, guesses after list invalidation, or loses the current run/filter context.
5. Given Draft line quantity, price override, template or removal changes an amount, when Finance confirms the action, then the dialog states the affected Invoice/run and retains the existing server-authoritative VND, reason/audit and refresh rules.

#### Story 6.7: Daily receipt queue and sequential settlement UX

As a Finance Manager, I want a Thu tien queue of issued Invoices with fast receipt confirmation and next-Invoice navigation, so that I can record daily collections accurately and efficiently.

**Acceptance criteria:**

1. Given an authorized Finance user opens Thu tien in a visible School, when the route loads, then it shows a server-authorized, stable-order `ISSUED` Invoice table by default with bounded pagination and filters for SchoolYear, billing month, class and Student code/name.
2. Given Finance opens a row action, when it selects `Ghi thuc nhan`, then the receipt dialog shows only server-returned Invoice/outstanding context, accepts actual whole-VND input, requires explicit confirmation and keeps all existing CSRF/idempotency/Operation reconciliation behavior.
3. Given a receipt Operation completes, when the API returns `EXACT`, `SHORTFALL` or `OVERPAYMENT`, then the UI renders the returned actual amount, outcome, difference and carry/coverage result before offering an explicit `Hoa don tiep theo` action. It does not post, allocate or calculate any value for the next Invoice.
4. Given timeout, concurrent close, filter/order change, revoked capability or School switch, when Finance attempts next navigation, then the UI reconciles/reloads the server list and never shows a stale/foreign Invoice or submits a duplicate Receipt.

#### Story 6.8: Finance daily-work UX release gate

As a release owner, I want automated proof of Finance daily-work navigation and accessibility, so that table-first speed improvements do not weaken Finance safety or tenant isolation.

**Acceptance criteria:**

1. Given API tests for the Invoice queue, when filters, pagination/cursor, sort, cross-School requests, revoked capability and malformed cursor are exercised, then the query returns only authorized same-School rows in stable order and no raw audit/provenance fields.
2. Given Admin UI/E2E tests, when Finance uses tables, row menus, create/change dialogs, Draft next/previous and receipt-next flow, then keyboard navigation, focus trapping/restoration, errors, state refresh and responsive table action access pass.
3. Given timeout/retry/concurrent mutation tests, when Issue or Receipt becomes uncertain, then Operation reconciliation blocks duplicate mutation and next navigation until the authoritative outcome/list reload is available.
4. Given the complete Finance suite, when release verification runs, then no test permits browser-calculated VND/lifecycle, foreign School Invoice visibility, Parent mutation/data exposure, generic balance, partial/unallocated receipt or automatic next posting.

### 4.5 Epic and tracker changes after approval

**Epic changes:** Add Stories 5.16-5.17 under Epic 5 and Stories 6.7-6.8 under Epic 6 as UX remediation. Mark Epic 5 and Epic 6 `in-progress` while their remediation stories are unfinished. Completed historical Stories 5.1-5.15 and 6.1-6.6 remain `done` and are not edited.

**Proposed tracker state immediately after canonical artifact updates:**

```yaml
epic-5: in-progress
5-16-finance-table-first-catalog-va-giam-tru: ready-for-dev
5-17-dot-thu-table-first-va-ra-soat-draft-tuan-tu: backlog

epic-6: in-progress
6-7-hang-doi-thu-tien-va-settlement-tuan-tu: backlog
6-8-release-gate-ux-finance-hang-ngay: backlog
```

### 4.6 Explicit non-changes

1. No schema/ledger rewrite, alternative settlement model, Receipt grouping, partial/unallocated receipt, generic balance or manual carry.
2. No Parent payment confirmation, QR payment, bank integration or Parent exposure of Finance back-office information.
3. No Payroll route, data, capability or visual pattern is coupled to the Finance Invoice queue.
4. No change to `School` authorization, Finance capability resolution, API ownership or `Operation` scope.

## 5. Implementation handoff

| Recipient | Responsibility |
| --- | --- |
| Product/UX | Approve this proposal, update canonical UX spine and revise Finance mockups before implementation. |
| Product/Developer | Update Epic 5/6 follow-up stories, traceability table and `sprint-status.yaml`; preserve completed story history. |
| Developer | Discover existing list capabilities, define the narrow Invoice queue DTO only if needed, then build Stories 5.16, 5.17 and 6.7 in order. |
| QA/Developer | Build Story 6.8 test coverage and run API/Admin E2E regression before re-closing both epics. |

### Sequencing

1. Approve proposal.
2. Update UX spine and mockups to final reviewed contracts.
3. Update epics/traceability/tracker and prepare implementation specs.
4. Build Story 5.16, then 5.17, then 6.7.
5. Complete Story 6.8 and re-run Finance release verification.

### Success criteria

1. Kế toán opens each daily Finance task at a compact, table-first list rather than a long configuration form.
2. Every table row ends with an accessible `...` action menu consistent with student management.
3. Kế toán can process Draft Invoices sequentially without returning to and searching the list after every Student.
4. Kế toán can find an issued Invoice and record receipt from a dedicated queue, then deliberately proceed to the next authorized Invoice.
5. Important Finance mutations remain explicitly confirmed, reconciled and auditable.
6. Existing Finance authorization, VND, immutable ledger and settlement invariants continue to pass all regression tests.

## 6. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1 Triggering stories | [x] Done | Post-Epic-6 UX review of the Finance Admin implementation and completed Stories 5.1-5.15, 6.1-6.6. |
| 1.2 Core problem | [x] Done | Safe mutation UI is not optimized for high-frequency accountant work. |
| 1.3 Evidence | [x] Done | Review findings: form-first page, direct buttons, no receipt queue, no Draft next/previous, inconsistent dialogs. |
| 2.1-2.5 Epic impact | [x] Done | Add follow-up stories to existing Epics 5/6; no future epic invalidated. |
| 3.1 PRD | [x] Done | No core requirement conflict; UJ-3/UX delivery clarification only. |
| 3.2 Architecture | [x] Done | Narrow Finance read projection permitted under existing API/School/Finance boundaries; no new invariant. |
| 3.3 UX | [x] Done | UX spine, interaction primitives and Finance mockups require canonical update. |
| 3.4 Secondary artifacts | [x] Done | Epics, traceability, tracker, implementation specs, API/UI/E2E tests require updates. |
| 4.1 Direct adjustment | [x] Viable | Selected; medium-high effort and medium risk with bounded API/UI scope. |
| 4.2 Rollback | [x] Not viable | Existing Finance domain behavior is correct and should remain. |
| 4.3 MVP review | [N/A] | No scope reduction or capability removal is needed. |
| 4.4 Selected path | [x] Done | UX-first direct backlog adjustment. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-5 specify artifact changes, stories, sequence and owners. |
| 6.1-6.2 Review | [x] Done | Proposal preserves all Finance authority and ledger constraints. |
| 6.3 Approval | [!] Action-needed | Explicit approval is required before changing canonical artifacts, tracker or implementation. |
| 6.4 Tracker update | [!] Action-needed | Apply only after proposal approval. |
| 6.5 Handoff | [!] Action-needed | Start implementation after UX/mockup and backlog contract updates are approved. |

## 7. Approval request

Approve this proposal to update the canonical UX/mockup/backlog artifacts and begin Stories 5.16-5.17 and 6.7-6.8. The approved change is limited to Finance daily-work UX and a narrow server-authorized Invoice list projection; it does not alter Finance money, settlement, authorization or Parent scope.

## 8. Approval

Approved by Tony on 2026-09-26. Canonical UX, mockup, epic and tracker changes may proceed. Implementation starts only from the updated UX/mockup contract and follow-up stories.
