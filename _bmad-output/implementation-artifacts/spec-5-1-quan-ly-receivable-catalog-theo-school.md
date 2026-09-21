---
title: 'Story 5.1: Quản lý receivable catalog theo School'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '5318de6cc81a0bfa0d3d8e6f49a8d888b83838b3'
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

## Review Triage Log

### 2026-09-21 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 15 (high 4, medium 10, low 1)
- defer: 0
- reject: 1
- addressed_findings:
  - `[high] [patch]` Bổ sung integration suite PostgreSQL cho catalog Finance: tenant graph, lifecycle/history, BigInt, idempotency, Operation/audit và revoke được chạy qua harness chính thức.
  - `[high] [patch]` Khắc phục collision `X-Operation-Id`, lifecycle audit thiếu old/new state và trạng thái Receivable active dưới Group inactive.
  - `[high] [patch]` Bảo toàn Operation khi HTTP outcome không chắc chắn, giới hạn reconciliation và bỏ timer khi School/unmount đổi.
  - `[high] [patch]` Thay prompt lifecycle bằng dialog có field error accessible; thêm loading, empty và load-error table states.
  - `[medium] [patch]` Phân biệt validation inactive group với capability denial, không lộ target foreign/missing, và validate UUID trước Prisma query.
  - `[medium] [patch]` Bổ sung service, controller và workspace tests cho idempotency, CSRF/origin, VND, lifecycle availability, stale persisted Operation và HTTP 503 reconciliation.

## Auto Run Result

Status: done

Baseline revision: `5318de6cc81a0bfa0d3d8e6f49a8d888b83838b3` (`docs(planning): simplify finance invoice mvp`).

Summary: Đã triển khai Finance receivable catalog School-scoped gồm `ReceivableGroup`, `Receivable` và lifecycle history append-only; capability `FINANCE_MANAGE`; REST mutation bảo vệ CSRF/origin/idempotency/Operation/audit; workspace Admin có reconciliation; và migration PostgreSQL giữ composite tenant graph, partial unique code, BIGINT VND.

Files changed:
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260921000002_finance_receivable_catalog/migration.sql` - domain catalog, lifecycle, tenant relation và DB invariants.
- `apps/api/src/modules/finance/*` - Finance REST/service, authorization, operation reconciliation và unit/controller tests.
- `apps/api/src/integration/finance.integration.test.ts` - release proof PostgreSQL cho toàn bộ I/O matrix.
- `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/ops/ops.service.ts`, `apps/api/src/app.module.ts` - capability, provisioning và module integration.
- `apps/web/src/finance/*`, `apps/web/src/school-context.tsx` - Finance Admin workspace và navigation được server grant.

Review findings: 15 patches applied (high 4, medium 10, low 1); 0 deferred; 1 rejected. Follow-up review recommendation: true (score 31 từ 4 high, 10 medium, 1 low patched finding).

Verification performed:
- `pnpm --filter @passionedu/api test` - pass, 15 files / 75 tests.
- `pnpm --filter @passionedu/admin-web test` - pass, 7 files / 60 tests.
- `pnpm typecheck && pnpm test` - pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` from `apps/api` - pass; migration deployed and 8 files / 63 PostgreSQL integration tests passed.
- `git diff --check` - pass.

Residual risks: Controller origin/CSRF proof is unit-level while database suite invokes Finance service using the established integration convention. Catalog selection is exposed through `available`; actual Invoice-line enforcement belongs to Story 5.4 because Invoice lines are intentionally out of scope here.
