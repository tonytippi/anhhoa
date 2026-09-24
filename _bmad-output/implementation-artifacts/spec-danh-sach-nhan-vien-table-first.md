---
title: 'Danh sách nhân viên table-first có phân trang'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'cc92249'
context:
  - 'AGENTS.md'
  - '_bmad-output/implementation-artifacts/spec-phan-trang-danh-bo-va-foreground-stable.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Trang Nhân viên chưa theo bề mặt vận hành table-first của Học sinh và Phụ huynh: nó tải toàn bộ profile, không có filter/paging và dùng nút sửa trực tiếp trên từng row.

**Approach:** Đổi danh sách Nhân viên thành một read model phân trang server-authoritative, có filter/actions trước table, table nhân viên với menu `...`, và pagination dưới table. Giữ form/luồng phân công nhân sự là bề mặt tách sau danh sách và giữ các mutation hiện có.

## Boundaries & Constraints

**Always:** API authorize `ROSTER_MANAGE` và scope mọi query theo School trên server. Dùng offset pagination `page` mặc định 25, tối đa 100, metadata chuẩn và stable ordering có id tie-breaker. Search chỉ theo họ tên, mã nhân viên, email và số điện thoại; filter theo employment status và primary position; sort theo tên, chức danh hoặc trạng thái. UI giữ flow thống nhất `filter/actions -> table -> paging`, clear rows khi request mới, stale-response guard, loading/error/empty rõ và không optimistic update. Menu row có keyboard/focus behavior như danh sách hiện có; chỉnh profile mở flow sửa hiện hữu, không tạo quyền/membership mới.

**Ask First:** Dừng lại nếu cần migration/index, cần thêm class/assignment hiện hành vào row, cần hiển thị PII ngoài contact hiện có, hoặc cần thay đổi lifecycle/membership/capability.

**Never:** Không tải toàn bộ nhân viên để client tự filter/page; không tin School/filter/page browser state làm authorization; không thay đổi schema, membership/grant, assignment lifecycle, hoặc mutation/Operation semantics chỉ để đổi list UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Trang đầu | School có 31 nhân viên | API trả tối đa 25 row và meta; UI render current page | Loading thay rows khi response current đến |
| Filter/search | User search code/name/contact hoặc chọn status/chức danh | API trả đúng page scoped School, reset page 1 | Query invalid bị reject; UI giữ error rõ |
| Stale response | User đổi filter/page trước response cũ | Response cũ không ghi đè rows/current meta | Không hiện dữ liệu scope cũ |
| Chỉnh profile | User mở `...` của một row và chọn sửa | Mở flow sửa hiện có, mutation hoàn tất rồi reload query/page current | Giữ CSRF/idempotency/Operation reconciliation |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/roster/roster.service.ts` -- `staff()` hiện tải toàn bộ; thay bằng paged School-scoped projection, validated query/filter/sort và stable ordering.
- `apps/api/src/modules/roster/roster.controller.ts` -- `staff()` REST boundary cần nhận/forward query và trả metadata.
- `packages/contracts/src/index.ts` -- thêm Staff list query/row shared DTO, reuse offset meta/API list response.
- `apps/web/src/roster/roster-workspace.tsx` -- tách staff page/query state và request guard khỏi student/parent; render filter/actions, table, menu và pager; reload current query sau profile mutation.
- `apps/web/src/index.css` -- reuse roster table/pager/menu language, thêm tối thiểu staff table/control sizing nếu cần.
- `apps/api/src/modules/roster/roster.controller.test.ts` -- test query delegation/list response.
- `apps/api/src/integration/roster.integration.test.ts` -- test pagination/search/filter/sort, invalid query và tenant isolation.
- `apps/web/src/roster/roster-workspace.test.tsx` -- test table, controls, pagination, stale guard, menu keyboard và refresh after edit.

## Tasks & Acceptance

**Execution:**
- [x] API contracts, roster service/controller -- implement validated paged staff read model -- make server-authoritative staff table possible.
- [x] API tests -- prove meta/query bounds, stable sort/filter/search and School isolation -- protect the list boundary.
- [x] Admin workspace/CSS -- render staff filter/actions, table row menu and pager using established roster patterns -- align the operating layout.
- [x] Web tests -- cover current page, filters, stale requests, empty/error, keyboard menu and post-mutation reload -- prevent regressions.

**Acceptance Criteria:**
- Given an authorized user opens Nhân viên, when staff loads, then filter/actions appear before a paged table and pager appears below it.
- Given a School has more than 25 staff, when the user navigates pages or filters/searches, then only the server-returned current page displays and stale results cannot overwrite it.
- Given user opens a staff row menu, when selecting edit, then the existing profile flow opens and successful completion reloads the current query/page.
- Given a query references foreign/unavailable data or invalid page/filter values, when API handles it, then it rejects safely without cross-School disclosure.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- roster.controller.test.ts` -- expected: staff list boundary tests pass.
- `set -a && source ".env.test" && set +a && pnpm --filter @passionedu/api test:integration -- roster.integration.test.ts` -- expected: staff list PostgreSQL scope/paging tests pass.
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx school-context.test.tsx` -- expected: staff table/list behavior tests pass.
- `pnpm --filter @passionedu/api typecheck && pnpm --filter @passionedu/admin-web typecheck` -- expected: no TypeScript errors.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Read Model**

- Validate filter/page and return stable, School-scoped staff pages.
  [`roster.service.ts:391`](../../apps/api/src/modules/roster/roster.service.ts#L391)

- Forward list query through the authorized roster boundary.
  [`roster.controller.ts:178`](../../apps/api/src/modules/roster/roster.controller.ts#L178)

**Staff Workspace**

- Keep staff request generations isolated from student and parent list state.
  [`roster-workspace.tsx:463`](../../apps/web/src/roster/roster-workspace.tsx#L463)

- Render shared filter, table, row-menu and pager hierarchy.
  [`roster-workspace.tsx:1590`](../../apps/web/src/roster/roster-workspace.tsx#L1590)

- Preserve keyboard-safe edit dialog behavior and focused mutation flow.
  [`roster-workspace.tsx:1405`](../../apps/web/src/roster/roster-workspace.tsx#L1405)

**Regression Coverage**

- Cover scope, paging, filtering and query validation on PostgreSQL.
  [`roster.integration.test.ts:332`](../../apps/api/src/integration/roster.integration.test.ts#L332)

- Cover staff table requests, stale responses and accessible actions.
  [`roster-workspace.test.tsx:130`](../../apps/web/src/roster/roster-workspace.test.tsx#L130)
