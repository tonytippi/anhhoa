---
title: 'Cấu hình FinancePolicy và tài khoản nhận tiền có lịch sử'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_commit: 'cd6efe8a457b439dca2355eda6e4e403f958f4fc'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/decision-story-3-2-finance-policy-bank-account-2026-09-18.md'
warnings: []
deferred:
  - 'Epic 5 Finance must authorize active same-School BankAccount selection at Invoice issue; Story 3.2 intentionally provides configuration history only and its Never boundary excludes a downstream Finance selection API.'
---

<intent-contract>

## Intent

**Problem:** School Admin chưa có aggregate Settings School-scoped để quản lý phiên bản FinancePolicy và nhiều BankAccount active/inactive. Finance sau này cần đọc typed policy và chỉ chọn tài khoản active cùng School khi issue, mà không làm thay đổi Invoice/payment instruction snapshot lịch sử.

**Approach:** Mở rộng aggregate `settings` và Admin Settings surface theo pattern version/audit/Operation của Story 3.1. FinancePolicy immutable/effective-dated dùng `dueDaysAfterIssue`, tax label enum, debt scope trong cùng SchoolYear và reversal enum; BankAccount có financial identity immutable, lifecycle active/inactive có lý do, và template chuyển khoản cố định.

## Boundaries & Constraints

**Always:** Chỉ School Admin active trong School active được đọc/ghi; mọi query, mutation, unique, audit và Operation scope `schoolId`; mutation cookie-auth có origin validation, double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, transaction reauthorization và reconcile trước retry. FinancePolicy gồm `dueDaysAfterIssue` integer `0..365`, `taxTreatment` enum `NOT_APPLICABLE|TAX_INCLUDED|TAX_EXCLUDED`, `debtScope=CURRENT_SCHOOL_YEAR_ONLY`, `reversalMode=DIRECT|SCHOOL_ADMIN_APPROVAL`, effective date, actor và audit old/new. BankAccount có receiving bank, account number, account-holder và template đúng duy nhất `{{studentName}} {{className}}`; account field financial identity immutable, không hard-delete, tạo active, lifecycle active/inactive bắt buộc reason. Khi Invoice issue, Finance downstream render snapshot student name/class name đã chuẩn hóa tiếng Việt không dấu; Settings không tự render hoặc mutate Invoice, Receipt, ledger hay settlement.

**Block If:** Canonical decision mới mâu thuẫn với quyết định hiện hành mà không nêu rõ supersession, hoặc migration PostgreSQL không thể giữ tenant graph, policy append-only và account lifecycle history. Không tự mở rộng template cố định thành grammar/literal tự do.

**Never:** Không dùng JSON/key-value policy, không trao `SETTINGS_MANAGE` cho Finance Manager, không hard-delete hoặc unscoped update BankAccount, không dùng account inactive/cross-School cho Invoice mới, không thay đổi Invoice snapshot lịch sử, không thêm pricing/tax calculation/VAT, settlement, ledger hay Invoice implementation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo policy version | School Admin, `dueDaysAfterIssue` 0..365 và enum hợp lệ, effective date duy nhất | Immutable FinancePolicy School-scoped, audit old/new và completed Operation | Replay cùng fingerprint trả outcome đã lưu |
| Policy as-of | Có version trước/sau ngày yêu cầu | GET trả đúng typed immutable policy tại `asOf` trong `Asia/Ho_Chi_Minh` | Conflict effective date trả `fieldErrors.effectiveFrom` |
| Tạo/lifecycle account | School Admin, field account hợp lệ và template cố định | Account thuộc School, tạo ACTIVE hoặc transition có reason; lịch sử vẫn đọc được | Blank/malformed field, template khác hoặc ID khác School bị từ chối, không ghi mutation |
| Account inactive | Account inactive hoặc School khác | Không đủ điều kiện cho Invoice mới; historical read/snapshot không bị rewrite | API Finance downstream từ chối selection, không dựa client state |
| Dirty/timeout | Form dirty hoặc Operation chưa chắc chắn, user switch School | Guard chặn silent switch; UI clear stale state và chỉ reconcile Operation đúng School | Không retry POST trước reconciliation |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `School` (9-35) nhận relation FinancePolicy/BankAccount; model versioned tại 400-444 là mẫu unique `(schoolId,effectiveFrom)` và composite tenant identity.
- `apps/api/prisma/migrations/20260918000006_school_settings_versioned/migration.sql` -- mẫu append-only trigger/cleanup-safe history; migration mới bảo vệ FinancePolicy và lifecycle history, đồng thời chỉ cho phép update lifecycle columns trên BankAccount.
- `apps/api/src/modules/settings/settings.service.ts` -- `read()` (20-24), version/audit predecessor (25-34) và `mutate()` (37-40) là owner cho typed validation, reauthorization, Operation replay và audit.
- `apps/api/src/modules/settings/settings.controller.ts` -- REST app boundary cookie session và `assertCookieMutation`; thêm ba POST Settings-owned routes.
- `apps/api/src/modules/common/{audit,mutation-protection,operation-idempotency}.ts` -- bắt buộc reuse audit provenance, CSRF/origin/fingerprint và Operation collision semantics.
- `apps/api/src/modules/memberships/memberships.{controller,service}.ts` -- current canonical `GET /api/app/schools/:schoolId/operations/:operationId`; không tạo Settings reconciliation endpoint yếu hơn.
- `apps/api/src/modules/settings/{settings.service,settings.controller}.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- validation/as-of/append-only/tenant/lifecycle/audit/idempotency; integration cleanup transition trước account.
- `apps/web/src/settings/settings-workspace.tsx` -- `load`, `reconcile`, `post` và dirty/switch states (75-242) là REST-only reuse point cho Finance tab.
- `apps/web/src/settings/settings-workspace.test.tsx` và `apps/web/src/school-context.test.tsx` -- kiểm chứng confirmed state, field error/focus, timeout không repeat POST và stale School clearing.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html` -- Finance tab yêu cầu table-first policy history và BankAccount search/status/sort; mockup không thay thế API contract.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/implementation-artifacts/decision-story-3-2-finance-policy-bank-account-2026-09-18.md` -- chốt typed field/enums, template fixed và lifecycle -- ngăn schema/API khác nghĩa.
- [x] `apps/api/prisma/schema.prisma` và migration mới -- thêm enum/model FinancePolicy, BankAccount và append-only lifecycle composite School graph; database cấm identity mutation/delete -- bảo toàn tenant/history.
- [x] `apps/api/src/modules/settings/{settings.service,settings.controller}.ts` -- thêm aggregate read, policy version/create account/lifecycle POST và typed server validation/audit/Operation -- API giữ authorization/policy state.
- [x] `apps/api/src/modules/settings/*.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- proof range/enum/template/as-of/lifecycle/audit/idempotency/append-only/cross-School deny -- khóa finance configuration contract.
- [x] `apps/web/src/settings/settings-workspace.tsx` cùng tests -- render Finance table/form và immutable template, server error, dirty-switch guard/timeout reconcile -- client không tự tính eligibility hay retry POST.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ đánh dấu 3.2 done sau full verification pass.

**Acceptance Criteria:**
- Given School Admin tạo FinancePolicy version với `dueDaysAfterIssue` 0..365, tax/reversal enum và debt scope current-SchoolYear, when server persist, then aggregate đúng School-scoped, immutable, audit actor/old/new và Operation outcome.
- Given policy/account có history, when API resolve `asOf` hoặc account lifecycle, then version/account historical vẫn đọc đúng mà không rewrite data/snapshot Finance downstream.
- Given School khác, account inactive, malformed request, conflicting effective date hoặc key replay khác fingerprint, when request xử lý, then server từ chối không leak/cross-write và UI chỉ hiển thị server-confirmed state.
- Given draft Finance form hoặc uncertain mutation, when School switch/timeout xảy ra, then UI guard/reconcile theo Operation School-scoped trước retry và clear stale state.

## Design Notes

FinancePolicy dùng unique `effectiveFrom` và resolver latest-prior như Story 3.1; interval `[effectiveFrom, effectiveTo)` được derive khi đọc thay vì update version cũ, vì history phải append-only. BankAccount là historical configuration: immutable financial identity, create active và lifecycle transition có reason. Template lưu canonical fixed form; Invoice domain sau này render source facts snapshot rồi normalize Vietnamese without diacritics.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma schema hợp lệ.
- `pnpm --filter @passionedu/api test` -- Settings API unit/controller tests pass.
- `pnpm --filter @passionedu/admin-web test` -- Finance Settings UI tests pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- PostgreSQL Settings isolation/history suite pass khi local DB configured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- toàn workspace pass.
- `git diff --check` -- không whitespace error.

## Auto Run Result

### 2026-09-18 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10 (high 8, medium 2)
- defer: 1 (medium 1)
- reject: 6
- addressed_findings:
  - `[high] [patch]` Lưu lifecycle transition append-only có composite tenant graph và `sequence` monotonic per account, thay vì overwrite status hoặc dựa vào transaction-start timestamp.
  - `[high] [patch]` Thêm FinancePolicy/BankAccount history DTO và table-first Admin surface, cùng as-of policy/account lifecycle resolution.
  - `[high] [patch]` Bảo toàn Finance draft, accessible lifecycle confirmation/error state, empty filter status và blank due-day rejection.
  - `[high] [patch]` Mở rộng proof PostgreSQL và UI cho audit, immutable history, tenant deny, Operation reconciliation và state server-confirmed.

Status: done

Đã triển khai Settings-owned FinancePolicy versioned và BankAccount history: Prisma/PostgreSQL migration có typed enums, composite School/Membership/Operation graph, immutable identity/policy/lifecycle trigger và lifecycle sequence chống race. API thêm resolved/history GET cùng idempotent policy/account/lifecycle mutation; Admin Settings hiển thị table-first history, validation accessible, switch guard và reconciliation không retry POST.

Files changed:

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260918000007_finance_policy_bank_accounts/migration.sql` -- typed persistence, temporal/lifecycle integrity.
- `apps/api/src/modules/settings/{settings.service,settings.controller}.ts` -- REST aggregate, validation, audit và Operation workflow.
- `apps/api/src/modules/settings/*.test.ts`, `apps/api/src/integration/settings.integration.test.ts` -- unit/PostgreSQL proof.
- `apps/web/src/settings/settings-workspace.tsx` và test -- Finance Settings surface server-confirmed.
- `sprint-status.yaml` -- Story 3.2 complete.

Review findings: 10 patches applied (8 high, 2 medium), 1 deferred downstream Epic 5 account-selection contract, 6 rejected. Follow-up review recommendation: `true` (score 26 from patched findings).

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api test` -- 13 files, 51 tests
- `pnpm --filter @passionedu/admin-web test` -- 5 files, 49 tests
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- migration deployed; 7 files, 61 tests
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `git diff --check`

Residual risk: Epic 5 must enforce active same-School BankAccount selection at Invoice issue; it is recorded in `deferred` and intentionally not implemented by Settings.
