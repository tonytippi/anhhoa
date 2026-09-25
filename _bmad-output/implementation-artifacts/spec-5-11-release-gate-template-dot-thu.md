---
title: 'Story 5.11: Release gate template Đợt thu'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'a80fdbb3d2093992c09118326d49847f16e73f47'
baseline_commit: 'a80fdbb3d2093992c09118326d49847f16e73f47'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Workflow template Đợt thu và populated DRAFT đã được triển khai ở Stories 5.9-5.10, nhưng release gate chưa tập trung chứng minh đầy đủ các DB boundary, retry/race và browser adjustment theo acceptance contract.

**Approach:** Bổ sung regression proof trên PostgreSQL và Admin E2E cho các contract đã có, dùng server outcome và snapshot hiện hữu, không thay đổi model hay mở rộng phạm vi Finance.

## Boundaries & Constraints

**Always:** Finance command phải server-authorize `FINANCE_MANAGE` theo School, giữ origin/CSRF, UUID idempotency, Operation, audit, transaction, VND `BIGINT` và School-scoped graph. Template chỉ mutable ở `DRAFT`; browser chỉ gửi Receivable, quantity, expected version hoặc Invoice DRAFT adjustment hợp lệ và chỉ render API values.

**Block If:** Canonical mockup hoặc contract Finance yêu cầu thay đổi flow template -> preview -> READY -> generate -> DRAFT adjustment, hay thay đổi semantics timeout reconciliation/Switch context.

**Never:** Không thêm PromotionPolicy, Receipt, settlement, carry, service/attendance pricing, Parent/Teacher route, client-calculated VND, test-only production behavior hay sửa migration lịch sử.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| DB template boundary | Foreign graph, duplicate line, non-positive/non-integer quantity hoặc non-DRAFT mutation | Same-School FK, canonical unique line, positive quantity và lifecycle trigger chặn trước write | Không lộ dữ liệu tenant khác hoặc persist partial state |
| Idempotent/racing template mutation | Same key retry hoặc concurrent key khác cùng expected version | Retry replay đúng outcome không tăng version hai lần; chỉ một mutation thắng race | `IDEMPOTENCY_CONFLICT` hoặc version conflict, invariant còn đúng |
| Snapshot populated DRAFT | Generate template hợp lệ, rồi chỉnh dòng Invoice A | InvoiceLine/total là VND server-derived; adjustment A không sửa Invoice B hay run snapshot | Issued/cross-School mutation bị từ chối theo contract sẵn có |
| Browser release flow | Admin cấu hình, preview, READY, generate, mở DRAFT và chuyển School | UI chỉ hiển thị API value, không lộ School A sau switch | Timeout reconcile và stale School guard dùng Operation, không retry mù |

</intent-contract>

## Code Map

- `apps/api/prisma/migrations/20260924000000_collection_run_template_snapshot/migration.sql` -- evidence read-only cho composite School FK, unique line, positive quantity và DRAFT-only template trigger; không sửa migration lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- `saveTemplateLine()`, `removeTemplateLine()`, `templateSnapshot()` và transaction lock là behavior được gate, chỉ sửa nếu proof phát hiện contract không đúng.
- `apps/api/src/integration/finance.integration.test.ts` -- bổ sung PostgreSQL matrix cho template tenant/constraint/lifecycle boundary, exact idempotent replay, immutable snapshot và competing mutation.
- `apps/api/src/modules/finance/finance.service.test.ts` -- bổ sung fast validation proof quantity template bị chặn trước transaction.
- `apps/api/src/modules/finance/finance.controller.test.ts` -- giữ controller mutation proof browser payload không chứa pricing và origin/CSRF boundary nếu coverage cần mở rộng.
- `apps/web/src/finance/finance-workspace.test.tsx` -- thêm timeout reconciliation và stale School response regression cho template command, tái dùng `command()`/Operation guard hiện có.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seed tối thiểu Student thứ hai tại Release Gate A để E2E chứng minh adjustment isolation.
- `apps/web/e2e/finance-release-gate.spec.ts` -- chạy approved template flow, điều chỉnh populated DRAFT của Student A và xác nhận Student B/server values cùng School switch safety.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển Story 5.11 `done` sau test/review pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/finance.integration.test.ts` -- thêm release matrix trực tiếp cho cross-School template graph, unique/check/lifecycle DB guard, save/remove replay, immutable generated snapshot và concurrent template version; chứng minh contract tại PostgreSQL boundary.
- `apps/api/src/modules/finance/finance.service.test.ts` -- test quantity `0`, âm, fractional và non-numeric bị validation trước transaction; giữ production code nếu behavior đã đúng.
- `apps/web/src/finance/finance-workspace.test.tsx` -- proof template command timeout reconcile outcome server và không render result stale sau School switch.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seed Student eligible thứ hai cho School A mà không ảnh hưởng tenant B.
- `apps/web/e2e/finance-release-gate.spec.ts` -- mở populated DRAFT, chỉnh quantity Invoice A, xác nhận total API và Invoice B không đổi, rồi verify switch không giữ data A.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu 5.11 done sau verification và review.

**Acceptance Criteria:**
- Given fixture nhiều School/run/catalog/Student, when unit và PostgreSQL suite chạy template lifecycle, then tenant graph, unique line, positive integer quantity/VND, preview stale, lifecycle lock, snapshot, idempotency và concurrency đều pass.
- Given Admin hoàn tất template -> selection -> preview -> generate, when mở populated DRAFT và điều chỉnh một Student, then UI chỉ hiện server values và Invoice Student khác/run snapshot không bị rewrite.
- Given mutation Finance timeout hoặc School context đổi, when client reconcile Operation hay response cũ đến, then không retry mutation mù và không render/lộ data từ School khác.
- Given route, schema và browser bundle được kiểm tra, when release gate chạy, then không thêm service, PromotionPolicy, Teacher, Parent, Receipt, carry hay client-calculated VND dependency.

## Design Notes

Story này là gate, không phải một Finance behavior mới. Test direct PostgreSQL được dùng để chứng minh guard migration mà service happy path có thể che khuất; test browser vẫn chỉ thao tác qua public API và assert server outcome.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 2)
- defer: 0
- reject: 14
- addressed_findings:
  - `[medium] [patch]` Reconciliation template timeout nay render completed `DRAFT` outcome ngay cả khi Finance refresh sau đó thất bại.
  - `[medium] [patch]` Khôi phục browser proof issue snapshot cho hai Invoice và named close CollectionRun sau populated DRAFT adjustment.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller contracts pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` từ `apps/api` -- expected: PostgreSQL template release matrix pass trên test DB.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance reconciliation/Switch regression pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: populated DRAFT adjustment release workflow pass.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace type/test/whitespace checks pass.

## Auto Run Result

Status: done

Summary: Story 5.11 bổ sung release evidence cho CollectionRun template: PostgreSQL boundary/quantity/idempotency/race, reconciliation template timeout, populated DRAFT adjustment isolation và Admin browser flow từ template đến issue/close. Trong khi thực thi gate, E2E phát hiện và sửa two defects: quantity-only edit không còn tự tạo browser price override, và generated InvoiceLine JSON null được persist an toàn khi update.

Files changed:
- `apps/api/src/integration/finance.integration.test.ts` -- thêm PostgreSQL template release matrix cho tenant/lifecycle/idempotency/concurrency.
- `apps/api/src/modules/finance/finance.service.ts` -- chuẩn hóa nullable JSON snapshot khi edit populated DRAFT line.
- `apps/api/src/modules/finance/finance.service.test.ts` -- proof quantity template invalid bị reject trước transaction.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- thêm Student eligible thứ hai cho adjustment-isolation E2E.
- `apps/web/src/finance/finance-workspace.tsx` -- áp dụng Run outcome sau reconciliation và chỉ prefill actual price override.
- `apps/web/src/finance/finance-workspace.test.tsx` -- proof timeout reconciliation giữ server DRAFT outcome khi reload thất bại.
- `apps/web/e2e/finance-release-gate.spec.ts` -- proof template -> two populated DRAFT -> adjustment -> issue -> close -> School switch.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu Story 5.11 done.

Review findings: 2 medium patches đã áp dụng; 0 deferred; 14 rejected vì duplicate, yêu cầu đã được test hiện hữu bao phủ, hoặc ngoài acceptance Story 5.11. Follow-up review recommendation: true; patched score là 6 (`2 * 3`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass, 17 files / 122 tests.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- pass, 8 files / 121 tests trên `anhhoa_test`.
- `pnpm --filter @passionedu/admin-web test` -- pass, 9 files / 100 tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass.
- `NODE_ENV=test DATABASE_URL=$E2E_DATABASE_URL ... pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- pass, 1 test trên `anhhoa_e2e`; tất cả origin/session test values chỉ là local non-secret configuration.

Residual risks: Runtime warning `pg` concurrent `client.query()` và Vite bundle-size warning vẫn xuất hiện nhưng không làm fail gate. Full cross-portal `pnpm test:e2e` không chạy lại vì Story chỉ thay Admin finance release spec; targeted spec pass.
