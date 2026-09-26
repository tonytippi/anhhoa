---
title: 'Đợt thu table-first và rà soát Draft tuần tự'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_commit: 'f7b0909af8e02c83a74fc8206663a01580c7625c'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Đợt thu` currently starts with an inline form, has no server-backed list filtering/pagination, and Draft Invoice review has no way to proceed to the adjacent Student. An accountant must repeatedly return to and search the run table, while the browser has no safe source order for navigation after a mutation.

**Approach:** Make the monthly CollectionRun list the primary Finance surface, create/open runs through an accessible dialog, and add an API-authorized run/invoice list contract with a stable order. Draft review retains its originating server queue and only exposes explicit previous/next actions after the authoritative queue reloads following a change or Issue.

## Boundaries & Constraints

**Always:** The API reauthorizes `FINANCE_MANAGE` and selected School before every run/list/detail lookup; query filters, cursor and IDs are selectors, never authorization proof. The list uses bounded page size, normalized filters, opaque cursor and a documented stable server order with a unique tie-breaker. Draft navigation derives only from IDs/order returned by the current authorized response. On any mutation start, timeout/uncertain Operation, list/run/filter change, School switch, denied/not-found record or refresh failure, invalidate the queue and hide previous/next until reload succeeds. Existing Finance write endpoints retain CSRF, UUID idempotency, audit, lifecycle, preview fingerprint and Operation reconciliation. A completed save/Issue result remains visible; the UI never auto-opens or posts the next Invoice.

**Ask First:** Changing Invoice lifecycle, adding a generic cross-run Invoice queue, changing the existing CollectionRun/Invoice DTO beyond this table/read-navigation purpose, or making client-side sort/order authoritative.

**Never:** Do not implement `Thu tiền`, Receipt, settlement, carry, coverage, Parent/Payroll surfaces, client-calculated VND, browser-owned eligibility/status, automatic navigation, or a second Finance list protocol outside this run-scoped review requirement. Do not let a stale queue reveal an adjacent Invoice after authorization or School context changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Run landing | Authorized Finance opens Đợt thu | Server-filtered, paginated monthly run table is primary; create button opens named dialog | Empty/loading/error retain School/filter context |
| Open/create run | Month may already have a run | Dialog explains whether server returns existing run or creates one; terminal result opens returned run | Validation/timeout preserve dialog and reconcile Operation before retry |
| Draft sequence | User opens a Draft from a run invoice table | Detail records current server-returned order and shows previous/next only for authorized adjacent IDs | First/last row has no unavailable action |
| Draft mutation/Issue | Line action or Issue reaches terminal result | Show result first; invalidate navigation, reload originating server queue, then offer explicit adjacent action only after success | Refresh failure/timeout hides navigation and keeps result for reconciliation |
| Context loss | Filter change, School switch, denied/not-found adjacent or concurrent state change | Clear queue context and do not open guessed/stale Invoice | Reload authorized context or present safe error state |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.controller.ts` -- Finance route adapter; add only the School-scoped filtered/paginated run/read endpoint(s) needed by the Admin list.
- `apps/api/src/modules/finance/finance.service.ts` -- owns `listCollectionRuns`, `runInclude`, `runDto` and Invoice ordering; define normalized filters/cursor and add a unique stable order tie-breaker without changing write rules.
- `apps/api/src/modules/finance/finance.service.test.ts` and `finance.controller.test.ts` -- current Finance query/mutation conventions; prove filters, cursor validation, stable order and capability/School scoping.
- `apps/web/src/finance/finance-workspace.tsx` -- `load`, `refreshRun`, `chooseRun`, `openRun`, `openInvoice`, `saveLine`, `removeLine`, and `issueInvoice` are the queue invalidation/reload points; reuse Story 5.16 dialog and row-menu helpers.
- `apps/web/src/finance/finance-workspace.test.tsx` -- add run landing/dialog and prev/next queue regressions while retaining current Draft/Issue/Operation tests.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Admin Finance browser proof location for table, confirmation and contextual navigation.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/src/modules/finance/finance.controller.ts`, `apps/api/src/modules/finance/finance.service.ts` -- expose one Finance-authorized filtered/paginated CollectionRun/read projection with opaque cursor, normalized filters and stable order for the run table/Draft context.
- [ ] `apps/api/src/modules/finance/finance.service.test.ts`, `apps/api/src/modules/finance/finance.controller.test.ts` -- prove bounded query handling, same-School authorization, malformed/foreign cursor rejection and deterministic Invoice order including tie-breaker.
- [ ] `apps/web/src/finance/finance-workspace.tsx` -- replace inline run entry with table-first landing and managed create/open dialog; preserve list context and implement invalidation-safe explicit Draft previous/next navigation.
- [ ] `apps/web/src/finance/finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- cover dialog/menu/focus behavior, source-order boundaries, mutation/Issue reload, timeout/revoke/switch safety and no auto-navigation.

**Acceptance Criteria:**
- Given an authorized Finance user opens Đợt thu, when the list loads, then a concise filtered/paginated monthly run table is primary and creating/opening a month uses a named confirmation dialog.
- Given a Draft Invoice is opened from a run list, when the detail renders, then previous/next is computed solely from the captured, current server-authorized order and absent at a boundary or invalidated context.
- Given a Draft line changes or Issue completes, when the API returns terminal state, then the confirmed result is shown before an explicit next option becomes available after a successful originating-list reload.
- Given a timeout, concurrent change, filter/order change, School switch or denied adjacent item, when navigation is attempted, then no stale/foreign Invoice is opened and Operation/list reconciliation controls the recovery.
- Given all existing Finance commands, when this work ships, then VND, lifecycle, preview fingerprint, idempotency, audit and server authority are unchanged.

## Design Notes

The existing `run.invoices` server projection can remain the review queue only after its student-code order has a unique tie-breaker. The new list query is intentionally CollectionRun-scoped rather than a generic Invoice queue; Story 6.7 owns the daily `ISSUED` receipt queue. Local patching after a Draft edit is insufficient for navigation, even when the nominal sort field is unchanged, because the UX contract forbids a browser guess after invalidation.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: Finance list/read authorization, cursor and stable-order tests pass.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: run list/dialog and Draft contextual navigation tests pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin portal TypeScript build passes.
- `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` -- expected: Admin browser Finance navigation regression passes when local E2E environment is available.
- `git diff --check` -- expected: no whitespace errors.

**Residual verification gap:** `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` cannot start in this workspace because its seed startup targets PostgreSQL database `passionedu`, which does not exist locally (`P1003`). Focused API and Admin component suites cover the changed behavior; run the browser gate against the configured E2E database before release.

## Suggested Review Order

**Server-Authorized List Context**

- CollectionRun read projection validates cursor/filter scope and returns stable page order.
  [`finance.service.ts:1149`](../../apps/api/src/modules/finance/finance.service.ts#L1149)

- Invoice order has a unique server tie-breaker for contextual Draft navigation.
  [`finance.service.ts:1058`](../../apps/api/src/modules/finance/finance.service.ts#L1058)

**Table-First Run Workflow**

- Run list filtering, managed create dialog and accessible row menus replace inline entry.
  [`finance-workspace.tsx:1109`](../../apps/web/src/finance/finance-workspace.tsx#L1109)

- Queue invalidation and detail refresh prevent stale previous/next navigation after mutation.
  [`finance-workspace.tsx:286`](../../apps/web/src/finance/finance-workspace.tsx#L286)

- Explicit previous/next actions remain unavailable until current queue context is authorized.
  [`finance-workspace.tsx:1431`](../../apps/web/src/finance/finance-workspace.tsx#L1431)

**Regression Proof**

- Tests cover cursor safety, dialog flow, server order, invalidation and denied adjacent detail.
  [`finance-workspace.test.tsx:37`](../../apps/web/src/finance/finance-workspace.test.tsx#L37)
