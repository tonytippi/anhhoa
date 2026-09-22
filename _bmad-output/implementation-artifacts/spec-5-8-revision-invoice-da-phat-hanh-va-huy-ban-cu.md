---
title: 'Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ'
type: 'feature'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'efa99b25ffe61cc23521018ee8285311db027011'
baseline_commit: 'efa99b25ffe61cc23521018ee8285311db027011'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Invoice đã `ISSUED` không thể được sửa, nhưng Finance cần phát hành nghĩa vụ chính xác thay thế mà vẫn giữ nguyên lịch sử, snapshot và audit của bản cũ.

**Approach:** Finance chuẩn bị đúng một replacement `DRAFT` từ fact snapshot bất biến của source, rà soát nó qua flow DRAFT hiện hữu, rồi phát hành replacement và chuyển source thành `CANCELLED` trong cùng transaction có lineage, audit và Operation.

## Boundaries & Constraints

**Always:** Mọi command dùng `FINANCE_MANAGE` server-side, School scope, origin/CSRF, UUID `Idempotency-Key` và `X-Operation-Id`, fingerprint/replay/reconcile, reauthorization trong transaction, audit và locking. Replacement phải cùng School/Student/CollectionRun/source roster facts; source chỉ là `ISSUED`, bất biến hoàn toàn và chỉ được `CANCELLED` cùng lúc replacement phát hành. Database phải giữ một normal Invoice mỗi Student/run, một replacement mỗi source, cấm lineage thiếu/sai graph/self-reference/chain và cấm trạng thái mơ hồ. `CANCELLED` là terminal hợp lệ để close run; Invoice trong run `CLOSED` không đổi. VND vẫn `BIGINT`/JSON-safe và server tính total/snapshot.

**Block If:** Không có surface Receipt hoặc Parent hiện hữu trong repo để kiểm thử contract transfer/projection; không được suy đoán ledger, carry hay DTO Parent. Khi các surface đó xuất hiện, chúng phải chỉ append provenance và Parent chỉ thấy replacement payable.

**Never:** Không sửa source lines, payment instruction, issue snapshot, audit hay Receipt; không thêm Receipt, ledger, SettlementDifference, carry, generic credit/unallocated balance, supplemental run hoặc Parent route; không nới tenant/normal generation uniqueness hay cho client đặt total/status/lineage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chuẩn bị revision | Source cùng School là `ISSUED`, reason và idempotency hợp lệ | Tạo một replacement `DRAFT` cùng snapshot roster và `revisesInvoiceId`; source không đổi, audit/Operation được ghi | Retry giống hệt replay outcome |
| Phát hành replacement | Replacement DRAFT có line/tổng dương, BankAccount active, source còn `ISSUED` | Một transaction issue replacement, snapshot payment mới và đổi source thành `CANCELLED` | Failure/đua tranh rollback cả hai trạng thái |
| Graph hay lifecycle sai | Source không `ISSUED`, replacement/source khác graph, run `CLOSED`, reason thiếu, duplicate/changed key | Không có Invoice/revision/audit transition bất hợp lệ | Conflict/validation/not-found server-authoritative, không rò tenant |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `InvoiceStatus`, `Invoice` composite graph và unique normal Invoice là schema source; thêm self-lineage/replacement relation nhưng giữ generation contract.
- `apps/api/prisma/migrations/20260921000007_invoice_snapshot_guards/migration.sql`, `20260922000001_correct_collection_run_close_guards/migration.sql` -- guards issued snapshot/closed run hiện hữu cần mở rộng bằng migration revision, không sửa lịch sử migration.
- `apps/api/src/modules/finance/finance.service.ts` -- `invoiceDto()`, `issueInvoice()`, `draftInvoice()`, `lockRun()`, `audit()` và `mutate()` là boundaries tái dùng cho prepare/issue replacement, authorization, Operation và serial transaction.
- `apps/api/src/modules/finance/finance.controller.ts` -- `mutation()` là origin/CSRF/idempotency boundary cho endpoint revision.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `src/integration/finance.integration.test.ts` -- unit/controller và PostgreSQL proof cho lifecycle, lineage, tenant, retry và race; fixture issue/close hiện hữu tái dùng.
- `apps/web/src/finance/finance-workspace.tsx` -- `command()`/`reconcile()` và dialog focus management cung cấp timeout-safe Admin revision; UI Invoice DRAFT/ISSUED là điểm bổ sung action/read-only state.
- `apps/web/src/finance/finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- proof named confirmation, reconciliation, source cancelled/replacement issued và tenant switch.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ đổi 5.8 thành `done` sau implementation, review và verification hoàn tất.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration revision mới -- thêm status/lineage relation và PostgreSQL constraints/triggers cho normal/replacement cardinality, same graph, terminal immutability, atomic cancellation và close terminal set -- DB là authority kể cả direct write/race.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- thêm prepare revision và issue replacement commands/endpoints, tái dùng `mutate`, `transactionActor`, run/invoice locks, snapshot/audit/DTO patterns -- API có transaction và reconcile contract rõ ràng.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- chứng minh matrix, immutable source, DB graph attacks, idempotency, tenant/capability, close terminal và concurrent prepare/issue -- kiểm thử trên surface API/PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- thêm confirmation có reason/named action/focus, DRAFT replacement review, Operation reconciliation và readonly cancelled source -- browser không tự suy diễn lifecycle.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển 5.8 sang `done` sau verification -- tracker trung thực.

**Acceptance Criteria:**
- Given Finance Manager được cấp `FINANCE_MANAGE` và source Invoice `ISSUED` cùng School, when submit prepare với reason và UUID headers, then API tạo duy nhất replacement `DRAFT` từ immutable roster facts, giữ source nguyên vẹn, persist lineage/audit/Operation và replay retry giống hệt.
- Given replacement được rà soát và có BankAccount active, when Finance xác nhận issue replacement, then một transaction trả replacement `ISSUED` và source `CANCELLED` với snapshots/audit server-authoritative; lỗi, retry trùng hoặc race không để trạng thái trung gian.
- Given source/replacement wrong School/Student/run, source không `ISSUED`, run đã `CLOSED`, lineage duplicate/missing/chain, reason/key không hợp lệ hoặc fingerprint thay đổi, when command hay direct database mutation chạy, then bị từ chối không ghi chéo tenant hay làm yếu normal one-Invoice-per-Student/run.
- Given Admin đang xem source `ISSUED`, replacement `DRAFT` hoặc kết quả mutation timeout, when revision được chuẩn bị/phát hành, then UI yêu cầu reason và named confirmation có focus management, chỉ reconcile Operation trước retry, source hiển thị `CANCELLED` readonly và replacement do server trả về là bản có thể phát hành.

## Design Notes

AC yêu cầu replacement `DRAFT` tồn tại trước khi source bị `CANCELLED`, nên DB guard phải cho phép trạng thái chuẩn bị tạm thời nhưng chỉ cho source chuyển `CANCELLED` khi replacement đã được issue trong cùng transaction. `revisesInvoiceId` không được dùng như khóa ngoại lỏng làm mở unlimited Invoice: normal invoice dùng partial unique index, replacement dùng unique source và trigger kiểm graph. Receipt/Parent chưa có model/route nên không thể tạo proof giả; lifecycle source bất biến là điểm nối bắt buộc cho Epic 6/7.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance service/controller contracts pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` từ `apps/api` -- expected: PostgreSQL migration/lifecycle/lineage tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance revision UI tests pass.
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- expected: browser Finance revision flow passes.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace checks pass.

## Review Triage Log

### 2026-09-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 19 (high 5, medium 12, low 2)
- defer: 0
- reject: 1
- addressed_findings:
  - `[high] [patch]` PostgreSQL now prevents direct issued/cancelled inserts, invalid lineage graph, revision source snapshot drift, normal revision metadata, and source snapshot rewrite during cancellation.
  - `[high] [patch]` Revision issue serializes source, replacement, run, SchoolYear and BankAccount; it records source cancellation audit in the same scoped Operation.
  - `[medium] [patch]` Admin revision confirmation now traps/restores focus, exposes Finance-only lineage/reason, routes replacement issue correctly, and renders cancelled source history readonly.
  - `[medium] [patch]` Added API controller CSRF/origin, PostgreSQL tenant/lifecycle/idempotency/direct-write, and Admin issue-route/focus/read-only regression proofs.
  - `[medium] [patch]` Final hardening requires an open SchoolYear in the PostgreSQL lineage guard and locks BankAccount before replacement issuance.

## Auto Run Result

Status: done

Summary: Finance Manager can prepare exactly one same-School replacement DRAFT from an issued Invoice, review it using normal DRAFT controls, then atomically issue the replacement and cancel the source. PostgreSQL owns lifecycle, lineage, immutable snapshot and cardinality protection; API commands retain authorization, CSRF, idempotency, audit and Operation reconciliation; Admin presents accessible named confirmations and read-only history.

Files changed:
- `apps/api/prisma/schema.prisma` -- adds `CANCELLED` and immutable revision lineage fields/relations for Invoice.
- `apps/api/prisma/migrations/20260922000002_invoice_revision_lineage/`, `20260922000003_drop_legacy_invoice_student_run_unique/`, `20260922000004_harden_invoice_revision_guards/`, and `20260922000005_invoice_revision_closed_year_guard/` -- migrate cardinality and enforce authoritative PostgreSQL lifecycle, graph, snapshot, closed-year and run-finality guards.
- `apps/api/src/modules/finance/finance.service.ts` and `finance.controller.ts` -- add protected prepare/issue revision commands, scoped locking, audit and Admin DTO outcomes.
- `apps/api/src/modules/finance/finance.controller.test.ts` and `apps/api/src/integration/finance.integration.test.ts` -- verify controller protection, PostgreSQL lineage/lifecycle, authorization, idempotency and immutable history.
- `apps/web/src/finance/finance-workspace.tsx` and `finance-workspace.test.tsx` -- add named accessible revision workflow, replacement issue routing and cancelled-source history.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- marks Story 5.8 done after verification.

Review findings: 19 patches applied (high 5, medium 12, low 2); 0 deferred; 1 rejected. Follow-up review recommendation: true; patched score is 88 (`5 * 10 + 12 * 3 + 2`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass, 15 files / 92 tests.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` from `apps/api` -- pass, 8 files / 91 tests; 48 migrations applied/validated.
- `pnpm --filter @passionedu/admin-web test` -- pass, 7 files / 79 tests.
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- pass, 6 Playwright tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass.

Residual risks: A dedicated Playwright revision scenario is not yet present; the revision browser flow is covered by Admin component tests and the real PostgreSQL integration suite. Receipt transfer provenance and Parent effective-obligation projection have no implementation surface yet and remain for Epic 6/7, without introducing placeholder ledger or Parent behavior here. Existing warnings remain: `pg` warns about concurrent `client.query()` deprecation and Vite reports an Admin bundle above its recommended size; neither fails the test gates.
