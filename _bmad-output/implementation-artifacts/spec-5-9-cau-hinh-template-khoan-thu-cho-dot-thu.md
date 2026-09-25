---
title: 'Story 5.9: Cấu hình template khoản thu cho Đợt thu'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '2a673af3948ed2164e81847c7039d8263d37b414'
baseline_commit: '2a673af3948ed2164e81847c7039d8263d37b414'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance Manager cần cấu hình một danh sách khoản thu và quantity chung, authoritative theo School, cho một CollectionRun `DRAFT` trước khi preview và generate Invoice. Code đã có aggregate template, command và UI cơ bản, nhưng cần hoàn chỉnh bằng regression proof cho invalidation từ catalog và deterministic DTO ordering trước khi story được release.

**Approach:** Giữ CollectionRun template là aggregate hẹp: API nhận duy nhất Receivable, quantity và optimistic version; server xác thực graph/lifecycle, tính VND từ catalog, audit và idempotent Operation. Bổ sung test trên API/PostgreSQL cho catalog-fact stale và thứ tự amount/tie-breaker, sau đó xác nhận UI chỉ gửi và hiển thị server facts theo mockup đã duyệt.

## Boundaries & Constraints

**Always:** Template mutation chỉ dành cho `FINANCE_MANAGE` trong School context đã server-authorize, với origin/CSRF, UUID `Idempotency-Key`, `X-Operation-Id`, transaction, audit và Operation reconciliation. Mỗi line dùng Receivable active cùng School duy nhất trong run `DRAFT`; quantity là integer dương; default price/amount VND `BIGINT` được server tính. Template/catalog fact là một phần preview fingerprint; API trả line theo amount giảm dần, tie-breaker ổn định, không có position hay reorder.

**Block If:** Contract hoặc mockup canonical mâu thuẫn về template DRAFT, default-price calculation hoặc việc catalog thay đổi phải stale preview.

**Never:** Không nhận/gán price, amount, total, Student/Class scope, eligibility hay discount từ browser; không thêm ChargeRule, service/attendance pricing, PromotionPolicy behavior, Receipt, carry, Parent/Teacher route hoặc thay đổi snapshot/generate contract của Story 5.10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lưu template hợp lệ | Run `DRAFT`, Receivable active same-School, quantity `22`, version hiện hành | Persist/upsert canonical line, amount server-derived, audit/Operation; `35.000 x 22` trả `770.000` VND | Retry cùng key/fingerprint replay outcome |
| Input/lifecycle sai | Duplicate/foreign/inactive Receivable, quantity zero/am/fractional, stale version hoặc run non-DRAFT | Không tạo/sửa/xóa line hay rò fact cross-School | Validation/conflict trước write |
| Fact thay đổi sau preview | Catalog default price hoặc lifecycle đổi sau preview DRAFT | Preview fingerprint cũ không thể `READY`; client phải lấy preview mới | `PREVIEW_STALE`, không generate |
| Thứ tự trình bày | Nhiều template có amount khác nhau hoặc bằng nhau | DTO theo amount giảm dần, amount bằng nhau theo stable server id | Không có position/reorder state |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `CollectionRun`, `CollectionRunTemplateLine` và Receivable graph là ownership source của template.
- `apps/api/prisma/migrations/20260924000000_collection_run_template_snapshot/migration.sql` -- DB guard cho same-School relation, unique line, positive quantity và DRAFT-only mutation; không sửa migration lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- `saveTemplateLine()`, `removeTemplateLine()`, `templateSnapshot()`, `runDto()` và `amountDescending()` thực thi server-authoritative calculation, stale fingerprint, audit và ordering.
- `apps/api/src/modules/finance/finance.controller.ts` -- protected PUT/DELETE template commands qua `mutation()` để giữ origin/CSRF/idempotency contract.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL surface cho template graph/lifecycle, preview stale, VND calculation, tenant isolation và concurrency; bổ sung proof catalog mutation và deterministic ordering tại đây.
- `apps/api/src/modules/finance/finance.controller.test.ts` -- contract xác nhận browser payload không có pricing fields.
- `apps/web/src/finance/finance-workspace.tsx` -- DRAFT template table, exact command payload và timeout reconciliation; chỉ render server-returned price/amount.
- `apps/web/src/finance/finance-workspace.test.tsx` -- Admin regression cho exact template payload và server-only rendering.
- `apps/web/e2e/finance-release-gate.spec.ts` -- browser workflow template -> preview -> generate theo mockup approved.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ đổi Story 5.9 thành `done` sau test và review pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/finance.integration.test.ts` -- thêm fixture/assertion catalog default-price hoặc lifecycle đổi sau preview bị stale, và template DTO amount-desc/id-stable -- chứng minh preview không dựa client/cache và ordering không có semantics ẩn.
- `apps/api/src/modules/finance/finance.service.ts` -- chỉ chỉnh khi test cho thấy fingerprint/order hiện hữu không đáp ứng contract; giữ API input và Operation contract đã triển khai -- tránh mở rộng scope khi behavior đã đúng.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển 5.9 sang `done` sau toàn bộ verification/review -- tracker phản ánh release evidence.

**Acceptance Criteria:**
- Given Finance Manager có `FINANCE_MANAGE`, run tháng `DRAFT` và Receivable active cùng School, when thêm, bỏ hoặc đổi quantity với headers idempotency, then server persist một CollectionRunTemplateLine canonical theo run/Receivable, audit/Operation và trả default-price amount VND server-derived không có position/reorder.
- Given `Tiền ăn` có đơn vị ngày, default price `35.000` VND và quantity `22`, when API trả template DTO, then amount là `770.000` VND và browser không thể gửi price, amount, total hoặc scope per-Student.
- Given Receivable duplicate, inactive/foreign, quantity không phải integer dương, expected version stale hoặc run không còn `DRAFT`, when mutation chạy, then API/DB từ chối trước write, không lộ catalog/run cross-School và không làm yếu unique/lifecycle guard.
- Given Finance đã lấy preview DRAFT, when template, catalog default price hoặc lifecycle catalog đổi, then fingerprint cũ bị `PREVIEW_STALE` trước `READY`/generate; Given nhiều line, when DTO render, then thứ tự là amount giảm dần với tie-breaker server ổn định.

## Design Notes

`CollectionRunTemplateLine` lưu lựa chọn live trong giai đoạn DRAFT, không phải pricing snapshot. `templateSnapshot()` đóng băng các facts chỉ cho `GENERATED`; vì vậy Story 5.9 phải chứng minh một preview giữ catalog fact cũ bị invalidated, còn Story 5.10 mới chịu trách nhiệm chứng minh generated snapshot không đọc lại catalog live. UI filter Receivable chỉ là ergonomic aid, không là authorization boundary.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller contracts pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` từ `apps/api` -- expected: PostgreSQL template lifecycle, catalog stale và ordering proofs pass trên test database.
- `pnpm --filter @passionedu/admin-web test` -- expected: Admin template payload/server-rendered-value tests pass.
- `pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: approved Admin template workflow passes.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace checks và whitespace pass.

## Review Triage Log

### 2026-09-24 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (medium 3, low 1)
- defer: 0
- reject: 10
- addressed_findings:
  - `[medium] [patch]` Tách lifecycle facts dùng cho preview fingerprint khỏi generated `templateSnapshot`, bảo toàn snapshot historical tối giản.
  - `[medium] [patch]` Thêm PostgreSQL proof ReceivableGroup inactive sau preview trả `PREVIEW_STALE` và run vẫn `DRAFT`.
  - `[medium] [patch]` Đổi expected tie ordering để lấy từ persisted template-line IDs thay vì tự sắp xếp DTO response.
  - `[low] [patch]` Scope Playwright select/quantity controls vào region `Khoản thu trong đợt` để tránh strict locator collision với accessible region name.

## Auto Run Result

Status: done

Summary: Story 5.9 xác nhận template CollectionRun chỉ nhận Receivable/quantity/version từ browser, server tính VND và giữ DRAFT-only, tenant, idempotency, audit và Operation contracts. Preview fingerprint nay invalidates khi price, Receivable hoặc ReceivableGroup lifecycle catalog đổi; lifecycle facts không lọt vào generated immutable snapshot. Template DTO có ordering amount giảm dần/tie-breaker deterministic được kiểm thử, và Admin E2E dùng selector scoped theo approved template region.

Files changed:
- `apps/api/src/modules/finance/finance.service.ts` -- fingerprint live catalog facts trong preview/READY mà không persist lifecycle internals vào generated snapshot.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof catalog stale, snapshot hygiene và deterministic template ordering.
- `apps/web/e2e/finance-release-gate.spec.ts` -- scope template controls để browser gate bền vững với accessibility regions.
- `_bmad-output/implementation-artifacts/epic-5-context.md` -- refreshed canonical Epic 5 developer context.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- marks Story 5.9 done.

Review findings: 4 patches applied (medium 3, low 1); 0 deferred; 10 rejected as pre-existing/out-of-story or non-actionable. Follow-up review recommendation: true; patched score is 10 (`3 * 3 + 1`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass, 17 files / 121 tests.
- `set -a && source ../../.env.test && set +a && pnpm --filter @passionedu/api test:integration` from `apps/api` -- pass, 8 files / 118 tests against `anhhoa_test`.
- `pnpm --filter @passionedu/admin-web test` -- pass, 9 files / 99 tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass.
- `set -a && source .env.test && set +a && pnpm test:e2e` -- pass, 9 Playwright tests against `anhhoa_e2e`.

Residual risks: There is no supported API mutation for changing a Receivable default price; the stale-price proof uses a test-only direct PostgreSQL fixture mutation with triggers bypassed. The runtime warning from `pg` concurrent `client.query()` and Vite bundle-size warning remain non-failing pre-existing concerns.
