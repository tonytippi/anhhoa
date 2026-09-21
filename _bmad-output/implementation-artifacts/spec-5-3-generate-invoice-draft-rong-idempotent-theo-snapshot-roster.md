---
title: 'Story 5.3: Generate invoice draft rỗng idempotent theo snapshot roster'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '97171a00d6ce14bfc8218fee1bf520ff6bd2f53a'
baseline_commit: '97171a00d6ce14bfc8218fee1bf520ff6bd2f53a'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-manual-invoice-mvp.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-3-generated-student-addition-2026-09-21.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance có CollectionRun `READY` nhưng chưa thể tạo nghĩa vụ nháp theo roster đã chọn, bảo toàn lịch sử roster tại thời điểm generate, hoặc đối soát retry an toàn.

**Approach:** Từ một `CollectionRun` `READY`, API tự tái đánh giá policy selection authoritative trong transaction, tạo tối đa một Invoice `DRAFT` rỗng cho từng Student còn eligible, ghi immutable roster snapshot/outcome/audit/Operation và chuyển run sang `GENERATED`; Admin portal xác nhận bằng tên và chỉ hiển thị outcome do server trả.

## Boundaries & Constraints

**Always:** `FINANCE_MANAGE`, School scope, origin + double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, Operation replay và reauthorization trong transaction là bắt buộc. Generate chỉ từ `READY`, khóa School/run/SchoolYear, từ chối năm đã đóng và dùng lại đúng `selectionPreview` policy hiện hữu, không tin preview fingerprint hay student list từ browser. Invoice có unique DB `(schoolId, studentId, collectionRunId)`, giữ snapshot Student/enrollment/class/as-of facts, không có line hay tiền; outcome JSON-safe nêu created/skipped và replay nguyên outcome. Lifecycle history append-only phải ghi `READY -> GENERATED`.

**Block If:** Contract canonical thay đổi empty DRAFT, policy selection hoặc lifecycle Finance Admin MVP trong lúc thực hiện.

**Never:** Không thêm InvoiceLine, total/price/VND calculation, ChargeRule, bank/payment snapshot, issue/settlement/revision, thay đổi Student đã generate, Parent/Teacher API, hoặc dependency attendance/service/promotion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Generate hợp lệ | Actor Finance, run `READY`, selected roster còn eligible | Tạo đúng một empty `DRAFT` mỗi Student, persist roster snapshot, transition run sang `GENERATED`, Operation outcome phân loại created/skipped | Không lỗi |
| Roster thay đổi sau READY | Enrollment/class không còn effective/active tại as-of | Re-evaluate trong transaction, không tạo Invoice cho Student đó, nêu skip server-authoritative | Không dùng preview cũ hoặc partial write |
| Retry/concurrency | Cùng key hoặc concurrent command key khác | Cùng key/fingerprint replay Operation outcome; unique DB và service chỉ tạo một Invoice/student/run | Changed key reuse conflict; duplicate race không tạo duplicate |
| Invalid/state/tenant | DRAFT/GENERATED run, year đóng, foreign run, revoked capability | Không lộ cross-School data và không thay đổi run/invoice | State/capability/not-found conflict phù hợp |
| Thêm Student sau generate | Run `GENERATED`, Student same-School eligible chưa có Invoice | Tạo đúng một empty DRAFT với roster snapshot; Students đã generate vẫn lock | Server tự kiểm tra eligibility/existing Invoice, không tin browser |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm Invoice state/model, same-School composite relations, immutable roster snapshot fields và reverse relations; `CollectionRunStatus` đã có `GENERATED`.
- `apps/api/prisma/migrations/20260921000004_collection_run_lifecycle_history/migration.sql` -- CHECK hiện chỉ cho `DRAFT -> READY`; migration mới phải mở rộng append-only lifecycle contract trước khi ghi `READY -> GENERATED`.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `actor`, `mutate`, `lockRun`, `lockYear`, `selectionPreview`, audit và DTO patterns; thêm generate transaction, snapshot/outcome và generated run detail.
- `apps/api/src/modules/finance/finance.controller.ts` -- thêm command `POST collection-runs/:runId/generate` qua mutation guard và reconciliation surface hiện có.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `src/integration/finance.integration.test.ts` -- mở rộng unit/controller/PostgreSQL proof cho lifecycle, snapshot, idempotency, concurrency và tenant isolation.
- `apps/web/src/finance/finance-workspace.tsx` -- tái dùng `command`, `reconcile`, active-School request guards và run detail; thêm named confirmation, server outcome và generated status không suy eligibility local.
- `apps/web/src/finance/finance-workspace.test.tsx` -- kiểm tra confirmation, server-only outcome, uncertain Operation reconcile và stale School guard.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration Finance mới -- thêm Invoice DRAFT rỗng cùng snapshots roster và ràng buộc tenant/unique; cập nhật lifecycle CHECK cho `READY -> GENERATED` -- DB là hàng rào duplicate và history.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- triển khai generate/reconcile và add eligible Student sau GENERATED theo transaction/shared roster policy -- server giữ authorization, lifecycle, snapshot và outcome.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- test edge matrix, DB constraints, audit/Operation, 1,000 Student và race -- chứng minh release behavior PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- thêm confirmation focus-managed, generate/reconcile và render created/skipped -- browser chỉ gọi REST và không tính outcome.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu 5.3 `done` chỉ sau toàn bộ verification/review pass.

**Acceptance Criteria:**
- Given `READY` CollectionRun cùng School có nhiều Student selected, when Finance xác nhận generate, then mỗi Student còn eligible có đúng một Invoice `DRAFT` không line/total và snapshot roster thuộc billing-month as-of.
- Given roster facts thay đổi giữa preview/READY và generate, when server generate, then server tạo/skip từ policy hiện tại trong transaction, persist đúng reasons/outcome và không tin input browser.
- Given timeout, retry identical hoặc commands đồng thời, when client đối soát Operation hay DB unique, then không có Invoice/audit/lifecycle transition duplicate và identical retry trả original outcome.
- Given run sai state, SchoolYear đóng, capability revoke hoặc graph School khác, when gọi generate/read operation, then command không ghi và không lộ record ngoài School/actor context.
- Given generate hoàn tất hoặc kết quả không chắc chắn, when Admin portal render/reconcile, then confirmation gọi đúng command với idempotency headers, UI hiển thị created/skipped server-returned, chặn duplicate và không render response School cũ.
- Given CollectionRun `GENERATED`, when Finance thêm Student same-School không có Invoice, then server chỉ tạo empty DRAFT khi Student eligible tại roster-as-of và giữ generated Students/snapshot hiện hữu bất biến.

## Design Notes

Roster snapshot là kết quả thực tế từ `selectionPreview(tx, schoolId, run)` sau lock, không phải fingerprint/preview cache. Snapshot cần giữ Student code/name, enrollment ID/lifecycle/interval, class ID/name, SchoolYear/billing/as-of và provenance selection để thay đổi roster về sau không sửa lịch sử Invoice. Theo quyết định `decision-story-5-3-generated-student-addition-2026-09-21.md`, `GENERATED` khóa Students đã có Invoice nhưng cho phép command riêng thêm một Student eligible chưa có Invoice; command này không sửa selection hay snapshot cũ.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller tests pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` -- expected: chạy từ `apps/api`, deploy migration và PostgreSQL Finance suite pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace tests pass.
- `pnpm typecheck && pnpm test` -- expected: toàn workspace pass.
- `git diff --check` -- expected: không whitespace error.

## Review Triage Log

### 2026-09-21 - Review pass
- intent_gap: 1: (high 1)
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - none

### 2026-09-21 - Implementation review passes
- intent_gap: 0
- bad_spec: 0
- patch: 18 (high 2, medium 16, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Dùng một authoritative roster result để dựng eligibility và Invoice snapshot, tránh drift giữa read eligibility và read snapshot.
  - `[high] [patch]` Thêm DB guard immutable snapshot, School/run/period composite binding và forward-only corrective migration cho database đã áp dụng migration cũ.
  - `[medium] [patch]` Bổ sung generated-run Student addition theo canonical Epic, chỉ cho Student eligible chưa có Invoice và không thay đổi generated selection/snapshot.
  - `[medium] [patch]` Chuyển invoice creation sang PostgreSQL conflict-safe insert có `RETURNING`, nên outcome created/`INVOICE_EXISTS` phản ánh đúng record thật kể cả race.
  - `[medium] [patch]` Bổ sung named confirmation, outcome reconciliation, candidate reload theo run SchoolYear, CSRF coverage và PostgreSQL concurrency/immutability/lifecycle coverage.

## Auto Run Result

Status: done

Summary: Đã triển khai Finance Invoice `DRAFT` rỗng theo CollectionRun snapshot roster. Generate và post-`GENERATED` eligible Student addition đều server-authoritative, idempotent, School-scoped, audited và Operation-reconcilable. Generated Students/snapshot cũ được bảo toàn; Student mới chỉ được tạo khi eligible và chưa có Invoice.

Files changed:
- `apps/api/prisma/schema.prisma` và migrations `20260921000005` đến `20260921000008` -- Invoice graph, snapshot facts, lifecycle constraints và forward-only persistence guards.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- generate/add Student commands, conflict-safe outcomes, authorization, Operation, audit và snapshot lifecycle.
- `apps/api/src/modules/finance/finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- CSRF, PostgreSQL lifecycle/snapshot/race/tenant/performance coverage.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- named confirmation, generated Student UI, reconciliation và stale School guards.
- `_bmad-output/implementation-artifacts/decision-story-5-3-generated-student-addition-2026-09-21.md` -- accepted canonical behavior decision.

Review findings: 18 patches applied (high 2, medium 16, low 0); 0 deferred; 0 rejected. Follow-up review recommendation: true (high findings were corrected during the run).

Verification performed:
- `pnpm typecheck && pnpm test` -- pass; 7 Turbo tasks, API 79 tests and Admin web 65 tests.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` from `apps/api` -- pass; 8 PostgreSQL integration files / 78 tests, migrations deployed.
- `pnpm --filter @passionedu/api prisma:generate` and Prisma validation -- pass during implementation.
- `git diff --check` -- pass.

Residual risks: PostgreSQL integration runner emits an existing `pg` concurrent-query deprecation warning; it does not affect the passing Finance assertions. Changes remain uncommitted because no commit was requested.
