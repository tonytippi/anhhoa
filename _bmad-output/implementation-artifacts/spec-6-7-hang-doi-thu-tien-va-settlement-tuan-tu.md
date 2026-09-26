---
title: 'Hàng đợi Thu tiền và settlement tuần tự'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_commit: '36581d22aa1daa02346c47514749ca10184362f4'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-6-6-release-gate-cho-actual-receipt-carry-va-promotion-coverage-refund.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Actual Receipt is currently reachable only by opening an Invoice from a CollectionRun. This is inefficient for daily collection work and has no server-authorized `ISSUED` list or safe next-Invoice flow after a settlement.

**Approach:** Add a dedicated `Thu tiền` route with a minimal server-authorized `ISSUED` Invoice queue. It defaults to the current Vietnam billing month, filters issued obligation snapshots, uses `issuedAt ASC, id ASC` server order, reuses the protected one-Invoice receipt command, and offers an explicit next Invoice only after the terminal result and a refreshed queue.

## Boundaries & Constraints

**Always:** Queue reads and detail/receipt actions reauthorize active same-School `FINANCE_MANAGE` before lookup. The queue defaults to the current `Asia/Ho_Chi_Minh` billing month and accepts SchoolYear, billing month, immutable Invoice `classIdSnapshot`, and Student code/name query; no nickname/alias exists or is searched. Rows expose only ID, Student code/name, class snapshot, billing month, issued/outstanding VND and fixed `ISSUED` state. Cursor is opaque, bounded, filter-bound and School-bound. Server order is `issuedAt ASC, id ASC`. Receipt remains exactly one Invoice, actual whole VND, API-derived outcome/difference/carry/coverage, CSRF/idempotency/Operation reconciliation and append-only ledger behavior. After terminal close, show the returned result, reload the same normalized queue, then allow an explicit next item from that refreshed response only.

**Ask First:** Adding Student nickname/alias schema, searching live roster/class instead of Invoice snapshots, changing settlement semantics, exposing another Finance capability, or combining this queue with CollectionRun/Draft navigation.

**Never:** Do not add partial/unallocated/multi-Invoice receipt, generic balance, manual carry, Parent payment action/data, browser VND/lifecycle calculations, automatic next navigation, stale static client queue, Payroll dependency, or a receipt detail row that exposes audit/provenance/line/payment-instruction data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Queue landing | Authorized School Finance context | Current billing-month `ISSUED` rows in stable order; table-first with filters and final menu | Empty/loading/error retain selected School and normalized filters |
| Filter/pagination | SchoolYear/month/class snapshot/student code or name, cursor | API returns only matching same-School issued snapshots with bounded opaque cursor | Malformed, foreign or filter-mismatched cursor is rejected safely |
| Receipt close | Selected issued queue row and actual VND | Existing command returns closed Invoice with actual/outcome/difference/carry/coverage result | Validation/timeout preserves dialog; reconcile before retry; no duplicate post |
| Next receipt | Terminal result plus refreshed matching queue | User explicitly chooses next server-returned item | Next stays hidden for pending, reload failure, filter change, revoked School/capability or no row |
| Concurrent/revoked row | Selected row is closed, denied or unavailable | Queue/detail context clears; no stale/foreign Invoice opens | Reload server queue or display safe error |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.controller.ts` -- add a distinct School-scoped receipt-queue GET route; retain existing Invoice detail, receipt POST and Operation GET routes unchanged.
- `apps/api/src/modules/finance/finance.service.ts` -- add minimal queue DTO, snapshot filters, current Vietnam billing-month default, opaque cursor and stable `issuedAt/id` order; reuse `school`, `actor`, `invoiceDto` and `closeInvoice` authority paths.
- `apps/api/prisma/schema.prisma` and migration -- add only the composite Invoice index justified by queue equality filters and `issuedAt/id` traversal.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- prove query validation, minimal DTO, tenant/cursor isolation, ordering and concurrent/non-issued behavior.
- `apps/api/src/modules/authorization/authorization.service.ts` -- add server-returned `Thu tiền` navigation entry for existing `FINANCE_MANAGE`; no new capability.
- `apps/web/src/school-context.tsx` -- add dedicated `receipt-queue` route/view and render it only from authorized navigation/context.
- `apps/web/src/finance/receipt-queue-workspace.tsx` and test -- new table-first queue, filter state, row menu, protected receipt dialog/Operation reconciliation and explicit next after queue refresh. Do not reuse Story 5.17 static Draft queue state.
- `apps/web/e2e/finance-release-gate.spec.ts` -- add queue route, row-menu/keyboard, receipt reconciliation and explicit-next browser coverage.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/prisma/schema.prisma` and new migration -- add the scoped index required for `ISSUED` snapshot-filter queue traversal in `issuedAt ASC, id ASC` order.
- [ ] `apps/api/src/modules/finance/finance.controller.ts`, `apps/api/src/modules/finance/finance.service.ts` -- expose a minimal, filter-bound, cursor-safe receipt queue and class-filter options while retaining receipt command semantics.
- [ ] `apps/api/src/modules/authorization/authorization.service.ts`, `apps/web/src/school-context.tsx` -- publish and route `Thu tiền` under existing authorized Finance navigation.
- [ ] `apps/web/src/finance/receipt-queue-workspace.tsx` and test -- implement the queue, filters, accessible row menus/dialog and refresh-gated next Invoice behavior.
- [ ] Finance API integration/controller/unit tests and `apps/web/e2e/finance-release-gate.spec.ts` -- prove cursor/tenant/DTO safety, lifecycle/reconciliation and browser keyboard/focus flow.

**Acceptance Criteria:**
- Given an authorized Finance user opens Thu tiền, when the page loads, then it shows a table-first, current-billing-month queue of only same-School `ISSUED` Invoice snapshots ordered by `issuedAt ASC, id ASC` with filters for SchoolYear, month, class snapshot and Student code/name.
- Given a cursor/filter is supplied, when the queue query runs, then malformed, cross-School or filter-mismatched cursors are rejected and no raw audit, provenance, payment instruction, lines or settled row data is returned.
- Given Finance records an actual receipt from a row menu, when the Operation completes, then the UI shows only the returned settlement result before offering a deliberate next item from the freshly reloaded normalized queue.
- Given timeout, concurrent close, filter change, School switch, capability revoke or denied detail, when the user attempts next, then queue/detail state is cleared or reauthorized and duplicate/stale/foreign settlement cannot occur.
- Given the existing receipt contract, when this story ships, then one-Invoice append-only settlement, VND authority, exact-only coverage behavior and Operation reconciliation remain unchanged.

## Design Notes

`classIdSnapshot`/`classNameSnapshot` are used so daily receipt filtering retains the issued obligation’s historical class context. The default month is derived by the API, not browser time. Student search is limited to issued Student code/name snapshots because Student has no nickname/alias field; alias support belongs to a separately approved Student-data change.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: generated client reflects the queue index migration.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: receipt queue unit/controller safety passes.
- `TARGET_INTEGRATION_DATABASE_URL="$TARGET_INTEGRATION_DATABASE_URL" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL queue/receipt tenant and concurrency proof passes on `.env.test` target only.
- `pnpm --filter @passionedu/admin-web test -- src/finance/receipt-queue-workspace.test.tsx src/school-context.test.tsx` -- expected: queue/filter/dialog/next navigation behavior passes.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin portal TypeScript build passes.
- `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` -- expected: receipt queue browser flow passes in configured E2E environment.
- `git diff --check` -- expected: no whitespace errors.

**Residual verification gap:** `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` could not start because the local Playwright server environment is missing required `APP_WEB_ORIGIN`. Component, API unit/controller and `.env.test` PostgreSQL integration coverage passed; run the browser gate with its complete E2E environment before release.

## Suggested Review Order

**Queue Authority**

- API derives the current Vietnam billing month, scoped filters, cursor and remaining outstanding.
  [`finance.service.ts:400`](../../apps/api/src/modules/finance/finance.service.ts#L400)

- Receipt queue endpoints separate minimal row/detail projections from the posting command.
  [`finance.controller.ts:19`](../../apps/api/src/modules/finance/finance.controller.ts#L19)

**Daily Receipt Workflow**

- Dedicated workspace handles filters, protected receipt dialog, reconciliation and refreshed explicit next.
  [`receipt-queue-workspace.tsx:1`](../../apps/web/src/finance/receipt-queue-workspace.tsx#L1)

- Authorized navigation exposes the separate Thu tiền destination without a new capability.
  [`school-context.tsx:32`](../../apps/web/src/school-context.tsx#L32)

**Verification**

- PostgreSQL proof covers issued-only queue snapshots and closed-row removal.
  [`finance.integration.test.ts:1`](../../apps/api/src/integration/finance.integration.test.ts#L1)
