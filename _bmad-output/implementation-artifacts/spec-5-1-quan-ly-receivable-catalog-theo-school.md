---
title: 'Story 5.1: Quản lý receivable catalog theo School'
type: 'feature'
created: '2026-09-21'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-manual-invoice-mvp.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance Admin MVP cần một catalog khoản thu School-scoped, đáng tin cậy để Finance chọn đúng khoản trên Invoice DRAFT; không có dữ liệu đầu vào đủ tin cậy để tự động áp khoản theo rule.

**Approach:** Xây dựng `ReceivableGroup` và `Receivable` active/inactive cùng capability `FINANCE_MANAGE`. Story sau sẽ dùng catalog này để Finance tự chọn các dòng Invoice DRAFT có quantity dương; không triển khai rule engine.

## Boundaries & Constraints

**Always:** School là tenant root; API xác thực `FINANCE_MANAGE` từ active StaffProfile/Position/binding trên mọi request. Money là PostgreSQL `BIGINT`, REST chỉ trả safe JSON integer; catalog mutation có origin/CSRF, UUID idempotency, Operation và audit.

**Block If:** Canonical contract thay đổi scope manual Invoice MVP hoặc capability `FINANCE_MANAGE` trước implementation.

**Never:** Không tạo `ChargeRule`, `FIXED`/`MANUAL`, scope precedence, auto-charge, PromotionPolicy, service enrollment, Invoice line, Teacher/Parent/attendance dependency hay float/client-owned money authority.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo catalog hợp lệ | Actor có `FINANCE_MANAGE`, Group cùng School, optional code mới, default price VND dương | Persist Group/Receivable active, audit và Operation; REST trả DTO JSON-safe | Không lỗi |
| Code trùng hoặc graph sai tenant | Code đã có trong School hoặc Group UUID thuộc School khác | Không tạo/không lộ catalog ngoài School | `fieldErrors` hoặc denial trước write |
| Catalog inactive | Group/Receivable bị ngừng áp dụng | Vẫn đọc lịch sử; không thể dùng cho Invoice line mới ở Story 5.4 | Server từ chối selection mới |
| Retry mutation | Cùng actor/school/route/key/fingerprint | Replay outcome đã lưu, không duplicate | Fingerprint khác trả idempotency conflict |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- chưa có Finance catalog; thêm models, composite tenant relation và enum/lifecycle cần thiết.
- `apps/api/prisma/migrations/20260918000007_finance_policy_bank_accounts/migration.sql` -- mẫu Finance migration cho enum, `BIGINT`, composite FK và lifecycle history.
- `apps/api/src/modules/authorization/authorization.service.ts` -- thêm `FINANCE_MANAGE` capability catalog và Finance navigation projection.
- `apps/api/src/modules/ops/ops.service.ts` -- provisioning seed cho School Admin Position cần capability Finance mới.
- `apps/api/src/modules/settings/settings.service.ts` -- mẫu reauthorization trong transaction, audit, idempotency/Operation; không tái dùng hard-coded `SETTINGS_MANAGE`.
- `apps/api/src/modules/settings/settings.controller.ts` -- mẫu route Admin cookie mutation và headers canonical.
- `apps/api/src/integration/settings.integration.test.ts` -- mẫu PostgreSQL integration fixture tenant/capability/revoke/idempotency.
- `apps/web/src/settings/settings-workspace.tsx` -- mẫu Finance catalog workspace: stale School guard, accessible server errors, switch guard và Operation reconciliation.
- `apps/web/src/school-context.tsx` -- thêm view Finance và capability-gated navigation sau API projection.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration mới -- thêm catalog School-scoped, `BIGINT` default price dương, optional partial unique code và lifecycle không hard-delete -- giữ tenant/history contract.
- `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/ops/ops.service.ts`, migration capability -- thêm/seed `FINANCE_MANAGE` cho School Admin và Finance Manager Position -- cấp đúng authority, không dùng role name.
- `apps/api/src/modules/finance/*`, `apps/api/src/app.module.ts` -- thêm Finance catalog REST/service/controller với tenant scope, CSRF, audit, Operation/idempotency và DTO JSON-safe -- API là authority duy nhất.
- `apps/api/src/modules/finance/*.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- chứng minh validation, VND, tenant graph, active lifecycle, revoke và retry/concurrency -- release proof.
- `apps/web/src/finance/*`, `apps/web/src/school-context.tsx` -- thêm catalog Admin workspace với tables/forms, accessible errors, selected School, stale-state clear và reconciliation -- Finance chỉ thấy server-granted surface.

**Acceptance Criteria:**
- Given Finance-authorized actor trong selected School, when tạo hoặc ngừng áp dụng ReceivableGroup/Receivable, then server persist đúng School, audit/Operation và catalog inactive không dùng cho dòng mới nhưng vẫn giữ history.
- Given code, Group UUID, capability, School context hoặc VND không hợp lệ, when API nhận catalog request, then server từ chối trước write và không lộ/tạo dữ liệu cross-School.
- Given Finance catalog mutation timeout/retry, when cùng Idempotency-Key được gửi lại, then server replay một outcome; fingerprint khác conflict và UI đối soát Operation trước retry.
- Given Admin mở catalog, when đổi School, bị revoke hoặc response School cũ đến muộn, then protected state cũ bị xóa và UI chỉ render data server-authorized của School hiện tại.

## Design Notes

`Receivable` chỉ cung cấp default unit price. Story 5.1 không tạo Invoice line hoặc rule; Story 5.4 sẽ để Finance chọn Receivable, nhập quantity dương, rồi server tính total.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit tests và existing API tests pass.
- `TARGET_INTEGRATION_DATABASE_URL="$TARGET_INTEGRATION_DATABASE_URL" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Finance catalog isolation/idempotency suite pass using `apps/api/.env` configuration.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance catalog workspace tests pass.
- `pnpm typecheck && pnpm test` -- expected: workspace typecheck and tests pass.
