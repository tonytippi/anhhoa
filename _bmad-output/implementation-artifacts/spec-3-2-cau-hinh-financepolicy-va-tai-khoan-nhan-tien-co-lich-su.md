---
title: 'Cấu hình FinancePolicy và tài khoản nhận tiền có lịch sử'
type: 'feature'
created: '2026-09-18'
status: 'draft'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/decision-story-3-2-finance-policy-bank-account-2026-09-18.md'
warnings: []
deferred: []
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

- `apps/api/prisma/schema.prisma` -- Story 3.1 hiện chỉ có `SchoolProfileVersion`/`SchoolCalendarVersion`; cần thêm typed FinancePolicy và School BankAccount graph sau khi field contract được chốt.
- `apps/api/prisma/migrations/20260918000006_school_settings_versioned/migration.sql` -- mẫu composite tenant FK, unique `(schoolId, effectiveFrom)`, append-only trigger và cleanup-safe history rule.
- `apps/api/src/modules/settings/settings.service.ts` -- owner cho Settings read/as-of, typed validation, transactional reauthorization, Operation replay và audit predecessor; mở rộng thay vì tạo security path song song.
- `apps/api/src/modules/settings/settings.controller.ts` -- REST app boundary dùng `assertCookieMutation`; thêm endpoint chỉ sau khi request/response contract rõ ràng.
- `apps/api/src/modules/common/{audit,mutation-protection,operation-idempotency}.ts` -- bắt buộc reuse audit provenance, CSRF/origin/fingerprint và Operation collision semantics.
- `apps/api/src/modules/memberships/memberships.{controller,service}.ts` -- current canonical `GET /api/app/schools/:schoolId/operations/:operationId`; không tạo Settings reconciliation endpoint yếu hơn.
- `apps/api/src/modules/settings/{settings.service,settings.controller}.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- mở rộng proof validation, as-of, append-only, tenant isolation, account lifecycle/audit và idempotency sau khi contract rõ.
- `apps/web/src/settings/settings-workspace.tsx` -- REST-only Settings UI đã có server error, pending Operation reconciliation và school-switch guard; Finance tab phải reuse các state này.
- `apps/web/src/settings/settings-workspace.test.tsx` và `apps/web/src/school-context.test.tsx` -- kiểm chứng confirmed state, field error/focus, timeout không repeat POST và stale School clearing.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html` -- Finance tab yêu cầu table-first policy history và BankAccount search/status/sort; mockup không thay thế API contract.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/implementation-artifacts/decision-story-3-2-finance-policy-bank-account-2026-09-18.md` -- chốt typed field/enums, template fixed và lifecycle -- ngăn schema/API khác nghĩa.
- [ ] `apps/api/prisma/schema.prisma` và migration mới -- thêm FinancePolicy immutable effective-dated và BankAccount historical School-scoped cùng composite integrity/append-only rule phù hợp -- bảo toàn tenant và history.
- [ ] `apps/api/src/modules/settings/{settings.service,settings.controller}.ts` -- thêm Settings read/write/lifecycle API, server validation, audit và Operation -- API giữ authorization/policy state.
- [ ] `apps/api/src/modules/settings/*.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- proof matrix cho as-of, lifecycle, audit, idempotency, append-only và cross-School deny -- khóa finance configuration contract.
- [ ] `apps/web/src/settings/settings-workspace.tsx` cùng tests -- render Finance tab server-confirmed, accessible error, dirty-switch guard và timeout reconciliation -- client không tự tính eligibility hay retry POST.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ đánh dấu 3.2 done sau full verification pass.

**Acceptance Criteria:**
- Given School Admin tạo FinancePolicy version với `dueDaysAfterIssue` 0..365, tax/reversal enum và debt scope current-SchoolYear, when server persist, then aggregate đúng School-scoped, immutable, audit actor/old/new và Operation outcome.
- Given policy/account có history, when API resolve `asOf` hoặc account lifecycle, then version/account historical vẫn đọc đúng mà không rewrite data/snapshot Finance downstream.
- Given School khác, account inactive, malformed request, conflicting effective date hoặc key replay khác fingerprint, when request xử lý, then server từ chối không leak/cross-write và UI chỉ hiển thị server-confirmed state.
- Given draft Finance form hoặc uncertain mutation, when School switch/timeout xảy ra, then UI guard/reconcile theo Operation School-scoped trước retry và clear stale state.

## Design Notes

FinancePolicy dùng unique `effectiveFrom` và resolver latest-prior như Story 3.1; interval `[effectiveFrom, effectiveTo)` được derive khi đọc thay vì update version cũ, vì history phải append-only. BankAccount là historical configuration: immutable financial identity, create active và lifecycle transition có reason. Template lưu canonical fixed form; Invoice domain sau này render source facts snapshot rồi normalize Vietnamese without diacritics.

## Auto Run Result

Status: draft

Blocking condition resolved by `decision-story-3-2-finance-policy-bank-account-2026-09-18.md`. The decision supersedes the earlier `studentCode + className` transfer-content rule for Story 3.2 and downstream Finance/Invoice implementation.
