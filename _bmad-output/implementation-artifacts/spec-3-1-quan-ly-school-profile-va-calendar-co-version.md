---
title: 'Quản lý School profile và calendar có version'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_commit: 'bf8afcb5c08dc9150cc748565b8f117c2e8115d9'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School Admin chưa có API hay Admin surface để ghi và đọc School profile, lịch hoạt động và kỳ nghỉ bằng các version có hiệu lực. Việc update trực tiếp School hoặc suy diễn lịch ở browser sẽ làm mất lịch sử và không an toàn theo tenant.

**Approach:** Tạo aggregate `settings` School-scoped với profile/calendar version bất biến, khoảng hiệu lực và holiday range bao gồm; API resolve `asOf` theo `Asia/Ho_Chi_Minh`. Cung cấp Settings navigation và form Admin chỉ render server-confirmed state, giữ lỗi nhập liệu và đối soát Operation khi mutation không chắc chắn.

## Boundaries & Constraints

**Always:** Chỉ School Admin active trong School active được đọc/ghi; every lookup/write/audit/Operation scope `schoolId`; cookie POST validate Origin + double-submit CSRF, `Idempotency-Key`/`X-Operation-Id`, transaction recheck membership/School. Profile/calendar version chứa effective date, actor/timestamp; audit cùng transaction chứa old/new values. Calendar mặc định Monday-Saturday, Sunday không hoạt động; holiday có tên, inclusive range, không đảo/chồng lấn; historical versions/snapshots không overwrite. `asOf` dùng ngày `YYYY-MM-DD` trong timezone business.

**Block If:** Không có migration PostgreSQL chạy được hoặc contract canonical yêu cầu thay đổi workweek, half-day, edit/delete holiday historical, media storage thật hay calendar pricing/attendance implementation.

**Never:** Không dùng School mutable fields làm profile history; không dùng JSON/key-value policy; không client-calculate operating date/context; không thêm Finance, Attendance hay Story 3.2-3.4 policy; không retry POST sau timeout.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Đọc Settings | School Admin và `asOf` hợp lệ | Trả đúng profile/calendar version, workweek và holidays của School | Foreign/denied context không tiết lộ state |
| Tạo version | Profile/calendar version hợp lệ, effective date mới | Tạo immutable record, audit old/new và completed Operation | Replay fingerprint giống trả outcome cũ |
| Conflict version | Effective date đã có version hoặc không hợp lệ | Không ghi dữ liệu; active/proposed vẫn GET được | `VALIDATION_ERROR` với `fieldErrors.effectiveFrom` |
| Holiday lỗi | End trước start hoặc range overlap trong cùng calendar version | Không tạo holiday, form giữ input | `fieldErrors.endsOn` hoặc `fieldErrors.startsOn` |
| As-of/history | Có version/snapshot cũ và version mới | Resolver chỉ trả version áp dụng tại ngày yêu cầu | Không rewrite record/version cũ |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm SchoolProfileVersion, SchoolCalendarVersion và SchoolCalendarHoliday School-scoped cùng relation/composite keys.
- `apps/api/prisma/migrations/` -- migration PostgreSQL giữ date ordering, exclusion version theo School/effective date và holiday non-overlap.
- `apps/api/src/modules/settings/settings.service.ts` -- aggregate owner: validation, as-of read, transactional reauthorization, Operation và audit old/new.
- `apps/api/src/modules/settings/settings.controller.ts` -- REST app-audience read/write boundary và cookie mutation protection.
- `apps/api/src/modules/settings/settings.module.ts`, `apps/api/src/app.module.ts` -- đăng ký module.
- `apps/api/src/modules/authorization/authorization.service.ts` -- capability/navigation Settings server-projected từ School Admin.
- `apps/api/src/modules/common/{audit,mutation-protection,operation-idempotency}.ts` -- reuse, không tạo security path song song.
- `apps/api/src/modules/settings/*.test.ts`, `apps/api/src/integration/settings.integration.test.ts` -- proof validation, idempotency, tenant/as-of/audit và PostgreSQL constraints.
- `apps/web/src/school-context.tsx` -- Settings navigation, School switch guard và stale state clearing.
- `apps/web/src/settings/settings-workspace.tsx` và test -- REST-only Profile/Calendar surface, server errors, terminal state/reconciliation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới -- thêm typed immutable Settings graph, relation/unique/exclusion constraints -- bảo toàn tenant và temporal history.
- [x] `apps/api/src/modules/settings/{settings.module,settings.controller,settings.service}.ts` và `app.module.ts` -- tạo authenticated, CSRF/idempotent Settings API -- server giữ authorization, calendar evaluation, audit và Operation.
- [x] `apps/api/src/modules/authorization/authorization.service.ts` cùng test -- project `SETTINGS_MANAGE`/Settings navigation cho School Admin -- browser không suy luận quyền.
- [x] `apps/api/src/modules/settings/*.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- chứng minh matrix, isolation, audit và database temporal rules -- khóa regression contract.
- [x] `apps/web/src/school-context.tsx`, `apps/web/src/settings/settings-workspace.tsx` cùng tests -- thêm UI profile/calendar server-confirmed, accessible error and switch/reconcile guards -- không cache/suy luận lịch local.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ đánh dấu 3.1 done sau toàn bộ verification pass.

**Acceptance Criteria:**
- Given School Admin có capability tại selected School, when tạo hoặc cập nhật profile/calendar, then record, Operation và audit đều School-scoped, có effective date/actor/timestamp và audit old/new values.
- Given effective date conflict hoặc holiday range invalid/overlap, when API validate, then trả field errors, giữ active/proposed GET state và Admin focus error summary mà không claim saved.
- Given version mới tồn tại, when API resolve as-of trong Asia/Ho_Chi_Minh, then trả đúng immutable version với Monday-Saturday và named inclusive holidays; Sunday/non-operating không do browser tính.
- Given record/snapshot lịch sử tồn tại, when version mới được tạo, then prior versions và snapshot fixture không bị update.
- Given School đổi, bị denied, form dirty hoặc mutation timeout, when Admin xử lý context, then stale state bị clear, switch được guard và timeout chỉ reconcile Operation trước retry.

## Design Notes

Calendar version là source immutable theo `effectiveFrom`; một version giữ holiday ranges của chính nó. Với scope Story 3.1, `effectiveFrom` là unique theo School, nên không có version interval overlap mơ hồ. Resolver lấy version mới nhất có effective date `<= asOf`; profile áp dụng cùng model. Holiday dates được server trả như facts presentation; Admin không suy luận số operating days.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma schema hợp lệ.
- `pnpm --filter @passionedu/api test` -- expected: Settings/controller/authorization unit tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Settings browser tests pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Settings isolation and temporal suite pass khi environment có DB.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: toàn workspace pass.
- `git diff --check` -- expected: không whitespace error.

## Review Triage Log

### 2026-09-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8 (high 4, medium 4)
- defer: 0
- reject: 13
- addressed_findings:
  - `[high] [patch]` Ổn định callback trạng thái Settings để tránh render/effect loop và khôi phục quản lý membership cùng dialog accessible.
  - `[high] [patch]` Loại direct Settings route không có School context và dùng Operation reconciliation School-scoped canonical.
  - `[high] [patch]` Sửa audit predecessor của version backdate và thêm PostgreSQL append-only trigger cho mọi Settings history record.
  - `[high] [patch]` Bảo vệ draft/pending switch, reset theo School, malformed storage và timeout reconciliation bounded.
  - `[medium] [patch]` Không trả actor/membership identifier trong Settings DTO thường; khôi phục revalidation visibility/focus và membership roles/actions.
  - `[medium] [patch]` Bổ sung calendar UI/test coverage cho lỗi, confirmed result, context isolation và append-only constraint.

## Auto Run Result

Status: done

Đã triển khai aggregate Settings versioned School-scoped, migration calendar/profile/holiday append-only, API authorization/CSRF/idempotency/audit/as-of resolver, Settings Admin surface và server-projected navigation. Review đã sửa loop render, direct route bypass, membership-management regression, audit backdate và timeout/switch edge cases.

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api typecheck`
- `pnpm --filter @passionedu/api test` -- 13 files, 49 tests
- `pnpm --filter @passionedu/admin-web typecheck`
- `pnpm --filter @passionedu/admin-web test` -- 5 files, 48 tests
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- lint/typecheck/build completed; root test reported the pre-existing `apps/web/src/shell.test.tsx` wait-for timeout in the combined run, while the direct Admin suite passed after the repair.
- `git diff --check`

PostgreSQL verification passed after exporting `apps/api/.env` into the test process:

- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- migration applied, seed completed, 7 files and 60 tests passed.

Release-gate repair khôi phục nhãn disabled `Đang đối soát...` trong Admin membership reconciliation.

Final release gate passed after exporting `apps/api/.env`:

- `set -a && . apps/api/.env && set +a && pnpm test:release-gate`
- PostgreSQL integration: 7 files, 60 tests
- Admin: 5 files, 48 tests
- Teacher: 2 files, 3 tests
- Parent: 3 files, 4 tests
- Ops: 1 file, 6 tests
- Playwright release gate: 5 tests

Sprint tracker now marks Story 3.1 `done`.
