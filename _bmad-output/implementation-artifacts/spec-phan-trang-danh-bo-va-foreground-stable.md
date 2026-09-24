---
title: 'Phân trang danh bộ và giữ dữ liệu khi quay lại foreground'
type: 'feature'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0ed00079259bf557418df2d884b13fe12c6ceca1'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quay lại ứng dụng sau alt-tab đang remount toàn bộ workspace Danh bộ và tải lại tất cả học sinh. Sau đó frontend gọi endpoint parent cho từng học sinh, gây N+1 requests, mất vị trí đang xem và UX chậm. Danh sách cũng chưa có phân trang dù mockup đã duyệt có filter, caption trang và pager.

**Approach:** Giữ nguyên roster đang xem khi browser trở lại foreground; chỉ tải lại khi người dùng yêu cầu, đổi query/page/school/year, hoặc sau mutation đã được server xác nhận. API trả danh sách học sinh phân trang cùng parent summary tối thiểu theo từng row, để frontend không gọi endpoint parent theo từng học sinh.

## Boundaries & Constraints

**Always:** API là nguồn authorization và mọi read/query phải scope School + SchoolYear trên server. Dùng server-side offset pagination `page`, mặc định 25 và tối đa 100. API trả metadata `page`, `pageSize`, `totalItems`, `totalPages`; ordering phải ổn định, có tie-breaker. List hỗ trợ q theo tên/mã học sinh, current class, lifecycle status và sort theo học sinh/lớp theo UI mockup. Parent summary chỉ hiển thị tên parent active đầu tiên, trạng thái và số link khi cần; không trả email hoặc số điện thoại. Giữ endpoint parent detail hiện hữu cho thao tác cụ thể. Giữ generation/request guards, no optimistic state, CSRF/idempotency/Operation behavior của mutations. Dữ liệu list chỉ tải trang/query đang chọn và error/loading/empty state phải rõ ràng.

**Ask First:** Dừng hỏi user nếu thay đổi cần migration/index mới sau khi đã kiểm tra query plan; nếu cần thay đổi layout/interaction ngoài mockup roster đã duyệt; hoặc nếu parent link editor không thể được di chuyển khỏi list mà vẫn giữ hành vi cần thiết.

**Never:** Không remount roster hay gọi roster API vì `focus`/`visibilitychange`; không gọi `GET /students/:studentId/parents` một lần cho mỗi row khi render list; không tin School ID, class ID, filter hoặc pagination browser state cho authorization; không trả contact detail phụ huynh trong roster row; không sửa schema/seed/API không liên quan hoặc artifact frozen của spec reload trước.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial list | SchoolYear có 127 học sinh | API trả 25 row đầu, parent summary, total và page metadata; UI hiển thị caption/pager | Loading thay bằng rows sau response hợp lệ |
| Foreground | Người dùng alt-tab rồi quay lại | Giữ rows, page, filters, scroll; không có roster hoặc parent request mới | N/A |
| Page/filter/sort | Người dùng đổi trang hoặc áp dụng filter | UI clear rows cũ, request query mới, chỉ render response current | Bỏ response stale; error không hiện empty state |
| Explicit refresh | Người dùng bấm Làm mới danh sách | Re-fetch đúng SchoolYear, query và page hiện tại | Disabled trong lúc tải; báo lỗi giữ state an toàn |
| Parent summary | Row có 0, 1 hoặc nhiều parent links | Hiển thị compact summary không chứa email/phone và không phát sinh detail GET | Parent detail chỉ tải qua thao tác cụ thể |
| Bad query | Page/pageSize/filter không hợp lệ hoặc class foreign | API chuẩn hóa page/pageSize hợp lệ hoặc reject foreign class trong SchoolYear | 400 cho query không hợp lệ, 404 cho class không thuộc scope |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx` -- foreground listener tại `revalidate` đang gọi `load()` và remount roster; loại bỏ behavior đó nhưng giữ school switching/denial flows.
- `apps/web/src/school-context.test.tsx` -- thay regression foreground remount bằng proof focus không tạo list/parent request mới.
- `apps/web/src/roster/roster-workspace.tsx` -- `loadYear()` hiện tải toàn bộ students rồi N+1 parent links; chuyển sang paged list query, parent summary, filters/mockup pager và explicit refresh, giữ guards/mutation reconciliation.
- `apps/web/src/roster/roster-workspace.test.tsx` -- fixtures đang trả raw array; cập nhật list response meta và test pagination, refresh, stale pages, no N+1.
- `apps/web/src/index.css` -- mở rộng styling hiện hữu cho filter/pager theo visual language đã duyệt.
- `apps/api/src/modules/roster/roster.controller.ts` -- parse/forward list query và trả `ApiListResponse` meta có dữ liệu.
- `apps/api/src/modules/roster/roster.service.ts` -- thay `students()` all-row query bằng School/SchoolYear-scoped paged row projection và compact parent summary.
- `apps/api/src/modules/roster/roster.controller.test.ts` -- cover query delegation/bounded paging response.
- `apps/api/src/integration/roster.integration.test.ts` -- update direct service callers và prove pagination/filter/School isolation/parent summary.
- `packages/contracts/src/index.ts` -- khai báo shared roster list DTO/query/meta nếu contract đang được export từ package này.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html` -- read-only approved source for filters, caption, compact parent column and page-number navigation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/roster/roster.service.ts`, `roster.controller.ts`, `packages/contracts/src/index.ts` -- implement validated, School-scoped paginated roster-list response with minimum parent summary and stable filters/sort.
- [x] `apps/web/src/school-context.tsx`, `school-context.test.tsx` -- stop foreground context reload/remount without weakening normal server authorization at request boundaries.
- [x] `apps/web/src/roster/roster-workspace.tsx`, `index.css` -- render approved search/filter/list caption/pager and explicit refresh; use only current paged row data and remove initial N+1 parent loading.
- [x] API and web roster test files -- update fixtures and add regression coverage for this behavior.

**Acceptance Criteria:**
- Given a 127-student SchoolYear, when the first roster page loads, then API returns at most 25 rows with exact pagination metadata and UI renders only that page.
- Given an authenticated user alt-tabs away and returns, when window focus/visibility changes, then existing roster UI remains mounted and no roster-student or per-student-parent GET is sent.
- Given a user changes page, filters, sort or SchoolYear, when the next list request is pending, then prior rows never represent the new scope and a stale response cannot overwrite it.
- Given a paged roster response, when rows render, then parent link display uses only response summaries and no `GET .../students/:id/parents` occurs for list hydration.
- Given explicit refresh or a completed roster mutation, when reconciliation finishes, then only the active roster query/page is reloaded from the server.
- Given an API list query, when it includes invalid scope or filtering identifiers, then service authorization and School/SchoolYear boundaries reject it without cross-tenant data.

## Design Notes

Page-number navigation is required by the approved mockup, so bounded offset pagination is preferred over cursor UX. The paged list is a read model, not the full student profile: history and parent management remain available through focused, on-demand surfaces rather than every row.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- roster.controller.test.ts` -- expected: controller list query and metadata tests pass.
- `set -a && source ".env.test" && set +a && pnpm --filter @passionedu/api test:integration -- roster.integration.test.ts` -- expected: PostgreSQL roster pagination/isolation tests pass.
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx school-context.test.tsx` -- expected: UI foreground, pagination, summary and stale-response regressions pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: no TypeScript errors.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Server Read Model**

- Defines the tenant-scoped, stable paged roster query and minimum parent summary.
  [`roster.service.ts:271`](../../apps/api/src/modules/roster/roster.service.ts#L271)

- Exposes query parameters and pagination metadata at the REST boundary.
  [`roster.controller.ts:143`](../../apps/api/src/modules/roster/roster.controller.ts#L143)

**Foreground And List UX**

- Removes foreground remount behavior while preserving normal school switching.
  [`school-context.tsx:201`](../../apps/web/src/school-context.tsx#L201)

- Loads only the active page/query and applies stale-response protection.
  [`roster-workspace.tsx:402`](../../apps/web/src/roster/roster-workspace.tsx#L402)

- Renders the compact list, filters, bounded pager, and explicit refresh control.
  [`roster-workspace.tsx:2238`](../../apps/web/src/roster/roster-workspace.tsx#L2238)

**Focused Detail Operations**

- Guards on-demand detail hydration and prevents older responses overwriting the current panel.
  [`roster-workspace.tsx:853`](../../apps/web/src/roster/roster-workspace.tsx#L853)

- Provides keyboard-safe focused detail actions outside compact roster rows.
  [`roster-workspace.tsx:2379`](../../apps/web/src/roster/roster-workspace.tsx#L2379)

**Verification**

- Proves page bounds, scoped filters, stable sorting, and private parent summaries on PostgreSQL.
  [`roster.integration.test.ts:115`](../../apps/api/src/integration/roster.integration.test.ts#L115)

- Covers list hydration, stale pages/details, focused panel behavior, and bounded navigation.
  [`roster-workspace.test.tsx:23`](../../apps/web/src/roster/roster-workspace.test.tsx#L23)
