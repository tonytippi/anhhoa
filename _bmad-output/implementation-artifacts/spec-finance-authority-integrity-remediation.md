---
title: 'Khắc phục authority và integrity cho refund eligibility và Finance export'
type: 'bugfix'
created: '2026-09-26'
status: 'in-progress'
baseline_commit: '497c69fe2b2f6576654493d80d06198459e47ca7'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/decision-epic-6-review-remediation-2026-09-26.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Workflow public ghi eligibility hoàn coverage đang cho phép các lý do không có authoritative source, guard reversal tại database chưa khóa coverage source trước khi tính cap, và tạo CSV export không có Operation/idempotency nên timeout có thể tạo nhiều export/audit.

**Approach:** Chỉ nhận evidence withdrawal đã được roster ghi immutable, khóa authoritative coverage row trong guard PostgreSQL trước tổng reversal, và biến CSV export thành Finance Operation idempotent được Admin reconcile trước download.

## Boundaries & Constraints

**Always:** `School` là tenant root; mọi authorization, Operation, export, audit và relation scoped School. Public eligibility chỉ hỗ trợ `WITHDRAWAL`, phải có enrollment cùng Student đã `WITHDRAWN` với effective date khớp, và từ chối `TRANSFER_OUT`/`ELIGIBLE_SERVICE_CANCELLATION` trước mutation vì chưa có authoritative source. Mọi coverage-reversal validation hiện hữu, append-only behavior, paid-source cap, VND `BIGINT`, và same-School constraints phải giữ nguyên. Migration chỉ forward-only. CSV export tạo record, audit và Operation trong cùng transaction; replay cùng key trả cùng outcome/export; browser giữ operation UUID khi timeout, GET `/finance/operations/:id`, chỉ download outcome completed.

**Ask First:** Hỏi trước khi thêm authoritative source hoặc public workflow cho transfer-out/service cancellation, đổi lifetime/download policy của export, hay thay đổi UI, receipt/provenance, mockup hoặc report scope.

**Never:** Không sửa migration cũ; không tin enrollment hiện hành/browser state; không tạo direct client CSV; không retry export với UUID mới sau timeout; không thêm UI receipt/provenance/mockup; không làm yếu DB direct-insert protections.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Withdrawal eligibility | WITHDRAWAL, same-School Student enrollment `WITHDRAWN`, matching effectiveOn | One immutable evidence, Operation and audit commit atomically; same key replays it | Foreign/missing/non-withdrawn/date mismatch creates no evidence |
| Unsupported eligibility | TRANSFER_OUT or ELIGIBLE_SERVICE_CANCELLATION | Reject before `mutate`/Operation creation | Validation states authoritative source unsupported |
| Concurrent direct reversal | Two direct SQL inserts/posts against same coverage that jointly exceed paid source | Row-level coverage lock serializes cap calculation; at most valid capped total persists | Losing transaction rejects and no over-refund row persists |
| Export timeout/replay | Same operation/key request retried or client loses POST response | Same completed Operation outcome returns one export and one request audit; Admin reconciles then downloads | Different payload/key collision is rejected; pending/failed operation never downloads |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `FinanceReportExport` currently lacks an `Operation` relation; add School-composite relation and unique operation mapping without altering eligibility enums/history.
- `apps/api/prisma/migrations/` -- latest Finance migration pattern; add a new dated migration containing export relation/backfill-safe constraint and `CREATE OR REPLACE` reversal guard with `StudentPromotionalCoverage ... FOR UPDATE` before aggregate/cap checks.
- `apps/api/src/modules/finance/finance.service.ts` -- `routes`, `requestReportExport` (currently standalone create/audit), `operation`, shared `mutate`, and `createCoverageRefundEligibility` around lines 128/513; reuse mutation actor/replay semantics and reject unsupported reason before `mutate`.
- `apps/api/src/modules/finance/finance.controller.ts` -- export endpoint must require `Idempotency-Key` and `X-Operation-Id`, validate cookie mutation through the same dedicated Finance route, and forward both fields.
- `apps/api/src/modules/finance/finance.controller.test.ts` and `finance.service.test.ts` -- update controller forwarding/header protection and focused service replay/rejection contracts.
- `apps/api/src/integration/finance.integration.test.ts` -- existing coverage cap/concurrency and export proof around lines 2533/2685; extend with PostgreSQL direct insert/concurrency and transactional operation/export/audit replay assertions.
- `apps/web/src/finance/finance-reports-workspace.tsx` -- export POST currently omits idempotency headers and immediately navigates; retain UUID operation state, reconcile Finance operation after uncertain response, and download only its completed export outcome.
- `apps/web/src/finance/finance-reports-workspace.test.tsx` -- update request headers and prove timeout reconciliation/no premature download; no visual/layout changes.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` and new `apps/api/prisma/migrations/<timestamp>_finance_authority_integrity_remediation/migration.sql` -- add School-scoped export-to-Operation relation/uniqueness and replace the coverage reversal guard so it locks the authoritative coverage row before reading prior reversals or enforcing cap.
- [x] `apps/api/src/modules/finance/finance.service.ts` and `finance.controller.ts` -- narrow public eligibility to authoritative withdrawal and make export a dedicated idempotent mutation that transactionally returns/replays an export outcome, Operation, and audit.
- [x] `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, and `src/integration/finance.integration.test.ts` -- prove rejection before mutation, exact withdrawal graph, export replay/collision/audit/operation behavior, and real PostgreSQL cap safety including direct insert if test setup permits.
- [x] `apps/web/src/finance/finance-reports-workspace.tsx` and test -- generate/request UUID headers, reconcile ambiguous export POST via Finance operation endpoint, and defer download until completed authoritative outcome without changing rendered report/mockup design.

**Acceptance Criteria:**
- Given a public eligibility command with transfer-out or service cancellation, when validated, then it fails before an Operation, audit, or evidence row is written.
- Given a valid withdrawal enrollment record, when the eligibility command runs or replays, then the stored source is same-Student/same-School withdrawn enrollment and its date is authoritative.
- Given concurrent direct database reversal attempts, when their combined amounts exceed paid coverage, then PostgreSQL permits no persisted total above cap while retaining prior append-only checks.
- Given an export POST receives a valid idempotency key and operation UUID, when it commits, retries, or response delivery is uncertain, then exactly one School-bound export/request audit exists and the client reconciles that operation before its single download navigation.

## Design Notes

The migration guard, rather than application lock ordering alone, is the direct-insert authority boundary. The export outcome should contain the opaque `exportId`, expiry and workspace so `GET /finance/operations/:id` remains sufficient after a POST timeout.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client accepts export Operation relation.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: focused Finance authority/export contracts pass.
- `set -a && source .env.test && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL coverage direct-insert/concurrency and export replay proof passes.
- `pnpm --filter @passionedu/api typecheck` -- expected: API compiles.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-reports-workspace.test.tsx` -- expected: report export timeout/reconciliation contract passes.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin compiles.
- `git diff --check` -- expected: no whitespace errors.
