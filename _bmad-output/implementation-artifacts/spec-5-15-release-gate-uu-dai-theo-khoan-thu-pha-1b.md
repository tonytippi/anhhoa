---
title: 'Story 5.15: Release gate ưu đãi theo khoản thu Pha 1b'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '91a5680e16809c9ceb36bba00424777d6ada1a32'
baseline_commit: '91a5680e16809c9ceb36bba00424777d6ada1a32'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 5.12-5.14 đã triển khai policy, evaluator, preview/generate và immutable Issue snapshot, nhưng chưa có một release gate tập trung chứng minh full contract Pha 1b qua PostgreSQL, REST/browser và kiểm tra phạm vi cấm.

**Approach:** Bổ sung regression proof trên fixture đa School và Admin E2E, cùng static release-scope assertion. Test phải quan sát server outcome, không tạo behavior Finance mới hoặc đưa settlement vào Epic 5.

## Boundaries & Constraints

**Always:** Dùng fixture PostgreSQL đa School; giữ `FINANCE_MANAGE`, origin/CSRF, UUID `Idempotency-Key`, Operation/audit, lock/transaction và VND integer server-authoritative. Gate phải chứng minh policy/target/assignment same-School, interval, deterministic fixed-before-percent/priority/exclusivity/cap, stale recheck, immutable issued application, retry/concurrency, và HTTP không nhận discount/total browser-owned.

**Block If:** Chứng minh yêu cầu release gate cần đổi lifecycle CollectionRun/Invoice, semantics evaluator hoặc mockup Finance đã duyệt thay vì chỉ bổ sung proof; dừng với quyết định cần làm rõ.

**Never:** Không thêm `PREPAID_COVERAGE`, `StudentPromotionalCoverage`, Receipt, settlement, carry, refund, debt/report, Parent/Teacher route, service/attendance pricing, credit line, browser-derived money, test-only production switch, hoặc sửa migration lịch sử.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Promotion release fixture | Hai School với policy/version/target/assignment, run và Invoice | Unit/integration tiếp tục chứng minh tenant, interval, audit/Operation, evaluator, stale preview/generate và issued snapshot | Foreign UUID, changed key và client money fields bị từ chối, không có partial write |
| Issue race and retry | Issue/revision cạnh mutation promotion, hoặc retry cùng key | Một outcome tuần tự: Issue nhất quán hoặc `PROMOTION_REVIEW_REQUIRED`; retry không duplicate snapshot | Operation/audit/application không partial hoặc cross-School |
| Browser promotion journey | Admin cấu hình/generate Invoice có ưu đãi và Issue | UI chỉ render gross/discount/net/reason/snapshot từ API, School switch xóa data cũ | Không có client money input hoặc blind retry |
| Forbidden release scope | Route/schema/bundle Finance Pha 1b | Không chứa settlement/coverage/Parent/Teacher/automatic-pricing dependency bị cấm | Static test fail với token hoặc import vi phạm |

</intent-contract>

## Code Map

- `apps/api/src/integration/finance.integration.test.ts` -- fixture đa School và proof policy/evaluator tại khoảng 347-517; Issue application/retry/stale/DB finality tại 2049-2096 là nền chính cho release matrix và race Issue/policy.
- `apps/api/src/modules/finance/finance.service.test.ts` -- evaluator fast proof tại khoảng 71-106; dùng để gate order/cap trước PostgreSQL suite.
- `apps/api/src/modules/finance/finance.controller.test.ts` -- Issue/origin-CSRF contract khoảng 88-137; bổ sung assertion DTO boundary loại bỏ browser `discount`/`total` nếu controller validation chưa chứng minh.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seed School A/B và Finance browser fixture; thêm policy/version/target/assignment tối thiểu cho hành trình promotion mà không tạo dữ liệu Epic 6.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Admin public-API workflow hiện có populated DRAFT, Issue và School switch; mở rộng assert calculated discount và issued promotion snapshot server-returned.
- `apps/web/src/finance/finance-workspace.tsx` và `.test.tsx` -- Invoice rendering uses API DTO; chỉ thêm test assertion nếu E2E không thể cô lập no-client-calculation/snapshot UI behavior.
- `apps/api/prisma/schema.prisma`, `apps/api/src/modules/finance`, `apps/web/src/finance`, `apps/parent-web`, `apps/teacher-web` -- read-only targets cho static scope test; không sửa chỉ để làm gate pass.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 5.15 sang `done` chỉ sau toàn bộ verification/review pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/finance.integration.test.ts` -- thêm/hoàn thiện PostgreSQL release matrix cho foreign promotion graph qua Issue, changed Idempotency-Key/client money rejection tại public boundary khi phù hợp, và Issue/revision race với policy mutation; chứng minh không partial application/audit/Operation.
- `apps/api/src/modules/finance/finance.controller.test.ts` và `finance.service.test.ts` -- bổ sung fast proof request payload không thể đặt gross/discount/net/total/formula và evaluator semantic; không thay đổi request contract nếu extra fields đã bị ignore safely.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seed một promotion Pha 1b deterministic cho Student release-gate A, giữ B độc lập và không thêm aggregate settlement.
- `apps/web/e2e/finance-release-gate.spec.ts` -- chạy browser public workflow có calculated promotion, assert gross/discount/net/reason và issued snapshot, sau đó verify School switch không render data A.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` hoặc test gate cùng vị trí phù hợp -- static assert schema/routes/bundle source Finance Pha 1b không kéo forbidden coverage/settlement/Parent/Teacher/automatic-pricing dependency; tránh false positive từ planning/history files.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 5.15 done sau test và review pass.

**Acceptance Criteria:**
- Given PostgreSQL fixture nhiều School, Receivable, policy version/target, assignment, run và Invoice, when unit/integration gate chạy, then tenant graph, effective interval, audit/Operation, fixed-before-percent, priority/exclusivity, gross cap, stale preview, Issue recheck, immutable snapshot, retry và concurrency pass.
- Given browser hoặc caller gửi cross-School UUID, changed `Idempotency-Key`, `discount`, `grossAmount`, `netAmount`, `total` hay formula, when command chạy, then server từ chối hoặc không dùng field đó và không persist outcome partial.
- Given Admin generate và Issue Invoice có promotion, when UI render hoặc School đổi, then chỉ hiện gross/discount/net/reason và issued snapshot do API trả cho School hiện hành; không local-calculate hoặc giữ data cũ.
- Given Pha 1b route, Prisma schema và Finance bundle/source được kiểm tra, when release gate chạy, then không có `PREPAID_COVERAGE`, `StudentPromotionalCoverage`, Receipt, settlement, carry, refund, debt/report, Parent/Teacher hay automatic operational pricing dependency.

## Design Notes

Release gate dùng integration proof cho tenant/transaction invariants và browser chỉ qua REST surface. Static scope test chỉ quét source runtime được chỉ định, không quét `_bmad-output` hoặc migration lịch sử để tránh biến tài liệu/quá khứ thành failure không liên quan.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1 (medium 1)
- defer: 0
- reject: 14
- addressed_findings:
  - `[medium] [patch]` Mở rộng static scope gate với Finance module route surface và token `Debt`/`Report`, tránh bỏ sót route hoặc phạm vi cấm được Story 5.15 nêu rõ.

## Auto Run Result

Summary: Hoàn thiện release gate Pha 1b cho ưu đãi theo khoản thu với PostgreSQL scope proof, Admin browser journey dùng giá trị server-returned, fixture đa School và static guard chống mở rộng sang settlement/coverage/cross-portal.

Files changed:
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seed promotion deterministic cho School A và dọn promotion graph khi rebuild fixture.
- `apps/api/src/integration/finance.integration.test.ts` -- chứng minh Issue bỏ qua total/discount/formula browser-owned.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- chặn forbidden scope trên schema, Finance route/service/controller và Admin workspace runtime source.
- `apps/web/e2e/finance-release-gate.spec.ts` -- xác nhận gross, discount, net, reason và issued snapshot server-returned sau School switch.
- `apps/web/e2e/release-gate.spec.ts` -- scope Teacher E2E selectors theo Student trong fixture đa học sinh.
- `apps/web/src/finance/finance-workspace.tsx` -- copy issued Invoice không khẳng định settlement ngoài phạm vi Epic 5.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu Story 5.15 và Epic 5 done.

Review findings breakdown: 1 medium patch applied (score 3), 0 deferred, 14 rejected vì là proof đã tồn tại ở Stories 5.12-5.14, scope mở rộng không được AC yêu cầu trực tiếp, hoặc nhận định không đúng fixture/test surface.

Follow-up review recommendation: false (patched high 0, medium 1, low 0; score 3).

Verification performed:
- `pnpm --filter @passionedu/api test:integration` -- pass, 9 files / 132 PostgreSQL integration tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass; API 128 tests, Admin 105 tests và toàn bộ workspace unit suite pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- Finance integration/Admin/Teacher/Parent/Ops layers pass; một lần chạy gặp Teacher shell assertion flake, chạy lại package pass.
- `set -a && source .env.test && set +a && DATABASE_URL=$E2E_DATABASE_URL NODE_ENV=test pnpm --filter @passionedu/admin-web exec playwright test` -- pass, 9 E2E tests.

Residual risks: Cảnh báo runtime hiện hữu từ `pg` concurrent query, React `act(...)` và Vite chunk size không làm fail test. Fixture E2E dùng direct Prisma inserts để dựng graph deterministic; lifecycle/audit/Operation promotion được chứng minh tại integration suite.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller request and evaluator contracts pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL promotion release matrix pass on test DB.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: Admin promotion journey uses server values and clears switched School state.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- expected: cross-portal release suite passes using only test databases.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace types/tests/whitespace pass.
