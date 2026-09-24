---
title: 'Danh sách phụ huynh table-first có phân trang'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: '830152da73850041235960af3fba51749d625679'
context:
  - 'AGENTS.md'
  - '_bmad-output/implementation-artifacts/spec-phan-trang-danh-bo-va-foreground-stable.md'
  - '_bmad-output/implementation-artifacts/spec-tai-cau-truc-danh-bo-theo-doi-tuong.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Submenu `Phụ huynh` hiện dùng lại bảng học sinh, nên nhân viên không thể quản lý contact phụ huynh theo một danh sách vận hành rõ ràng. API chỉ trả liên kết theo từng học sinh và không có read model phân trang cho các cột contact, tên con và lớp.

**Approach:** Thay bề mặt Phụ huynh bằng bảng-first theo visual language của danh sách Học sinh: mỗi dòng là một phụ huynh trong năm học đang chọn, có tên, số điện thoại, email, ô tổng hợp các con kèm lớp và menu thao tác. Thêm read model server-authoritative phân trang cho projection parent-first này; menu mở chi tiết phụ huynh để quản lý từng liên kết với con thay vì tạo quyền hay trạng thái cục bộ.

## Boundaries & Constraints

**Always:** Mỗi row là một `ParentProfile` có ít nhất một `StudentParent` active trong SchoolYear, nhưng ParentProfile chỉ được tìm qua các link scope School; một phụ huynh có nhiều con xuất hiện một dòng và ô con tổng hợp từng `studentName` + `className` active. Server phải authorize `ROSTER_MANAGE`, derive School scope từ actor/route authorization, scope link, Student, enrollment và class theo School + SchoolYear, và chỉ trả DTO tối thiểu: parent id/name, phone, optional email và mảng con gồm link id, student name, current class, relationship label. Dùng offset pagination `page` mặc định 25, tối đa 100, metadata chuẩn, thứ tự ổn định có tie-breaker, search server-side theo tên phụ huynh/tên con/số điện thoại/email. Reuse loading/error/empty, request-generation stale guard, pager tối đa năm số và keyboard-safe action menu của danh sách Học sinh. Menu row chỉ mở chi tiết phụ huynh; trong bề mặt đó, thao tác thu hồi vẫn là POST có Origin/CSRF, UUID idempotency key và Operation reconciliation; không optimistic update.

**Ask First:** Dừng lại nếu query plan cho thấy phải thêm index/migration; nếu cần mở rộng action ngoài xem hồ sơ học sinh hoặc thu hồi liên kết; nếu yêu cầu hiển thị link revoked cùng danh sách active; hoặc nếu implementation cần sửa mockup final thay vì chỉ ghi nhận quyết định UI mới trong implementation artifact.

**Never:** Không trả dữ liệu phụ huynh ngoài School/SchoolYear hiện hành, không coi profile hay email là login/quyền, không hard-delete profile/link/lịch sử, không N+1 gọi detail parent khi hydrate table, không dùng browser School/year/filter làm authorization, không thay đổi lifecycle enrollment hoặc tạo parent profile mới từ bảng, không đặt thao tác thu hồi hàng loạt hoặc thu hồi mặc định trên row parent.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Danh sách active | Năm học có 31 link active thuộc 20 phụ huynh | API trả trang 1 gồm tối đa 25 parent rows có contact và mảng con/lớp; UI chỉ render rows trang đó và pager | Loading thay bằng response current; empty state rõ nếu không có link |
| Một phụ huynh nhiều con | Một `ParentProfile` có hai active links trong năm học | Render một dòng với hai con/lớp trong cùng ô; menu mở chi tiết để các link có action chính xác | Không aggregate status/action thành thao tác mơ hồ |
| Contact không email | `emailNormalized` là `null` | Cột Email hiển thị dấu `-`, phone/name vẫn hiển thị | Không lọc bỏ row hoặc suy diễn account |
| Đổi trang/tìm kiếm | Response cũ đến sau query mới | Rows cũ bị clear khi load; chỉ response generation hiện hành được commit | Stale response bị bỏ qua, error không biến thành empty |
| Thu hồi | Admin mở menu parent, vào chi tiết và chọn Thu hồi tại một active link | POST idempotent/reconcile; sau kết quả server xác nhận reload đúng query/page | Timeout giữ Operation ID để đối soát trước retry |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/parents/parents.service.ts` -- owner của `StudentParent`; thêm parent-first list projection School/SchoolYear scoped, aggregate con active, validation query, stable order và DTO minimum, không thay đổi create/revoke semantics.
- `apps/api/src/modules/roster/roster.controller.ts` -- boundary roster hiện có cho list học sinh và parent mutation; expose GET paged parent-link list, forward validated query và giữ actor authorization.
- `packages/contracts/src/index.ts` -- tái dùng `ApiListResponse`/`OffsetPaginationMeta`; thêm query và row contract cho parent-link list.
- `apps/web/src/roster/roster-workspace.tsx` -- `section="parents"` hiện dùng student list; tách state/fetch/render parent page, render danh sách con trong row, reuse pager, stale guards, row-menu focus behavior và mở detail parent để quản lý link/revoke.
- `apps/web/src/index.css` -- tái dùng table/pagination/menu visual language roster, thêm tối thiểu responsive width/column styling cho parent table.
- `apps/api/src/modules/roster/roster.controller.test.ts` -- assertion query forwarding và API list response.
- `apps/api/src/integration/roster.integration.test.ts` -- verify School/SchoolYear isolation, active-only status, DTO, pagination, stable ordering/search và revoke history không lộ vào default list.
- `apps/web/src/roster/roster-workspace.test.tsx` -- verify parent table does not render student rows, current-page-only, stale guards, no detail N+1, action menu keyboard và refresh after revoke.
- `apps/web/src/school-context.test.tsx` -- confirm submenu Phụ huynh opens the independent parent list.
- `_bmad-output/implementation-artifacts/decision-parent-list-table-first-2026-09-24.md` -- record user-authorized departure from the old parent-link mockup before implementation; do not edit final UX mockup directly.

## Tasks & Acceptance

**Execution:**
- [x] API contracts, `ParentsService` and roster controller -- add the tenant/year-scoped paged parent-first read model, aggregate active children and REST boundary -- make the requested table possible without client aggregation.
- [x] API controller/integration tests -- cover DTO disclosure, query bounds, search/order and School/SchoolYear isolation -- protect the new authorization/data boundary.
- [x] UI decision artifact -- record that the user approved a student-list-style, table-first parent view with paging and row actions, replacing the old mockup interaction for implementation -- preserve traceability without editing frozen UX output.
- [x] `roster-workspace.tsx` and `index.css` -- render the parent-only table with a compact multi-child cell and existing visual patterns, with responsive scroll and accessible action menu opening parent detail -- provide the requested operating surface.
- [x] Web tests -- cover paging, stale fetches, empty/error, multiple children in one row, no-email display, keyboard menu and mutation reload -- prevent UI regressions.

**Acceptance Criteria:**
- Given an authorized staff member selects `Phụ huynh` and a SchoolYear, when the list loads, then they see a paged table with parent name, phone, email, children/classes and a trailing action menu, not the student roster table.
- Given a parent has links to multiple students in the selected year, when rows render, then one row lists every child/class and the row menu opens detail where an action affects only the chosen link.
- Given page/query/school/year changes during an in-flight request, when any response returns, then no stale parent data can overwrite the current scope.
- Given a contact has no email, when its row renders, then the contact remains visible and email is shown as unavailable without implying login access.
- Given staff revokes a parent link from the parent detail opened by the row menu, when the server Operation completes, then the current parent query/page reloads and the child is removed from that parent row or the row disappears if it has no remaining active links.

## Design Notes

The Kidsonline reference supplies density and scan order, not a visual replacement: keep PassionEdu's existing table, caption, filters, pagination and accessible `...` menu styles. The row is parent-first because this is a parent-management surface; `StudentParent` remains the identity of each child item/action within its detail, where lifecycle operations are unambiguous.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- roster.controller.test.ts` -- expected: controller query and list contract tests pass.
- `set -a && source ".env.test" && set +a && pnpm --filter @passionedu/api test:integration -- roster.integration.test.ts` -- expected: PostgreSQL tenant/year pagination and parent-link lifecycle tests pass.
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx school-context.test.tsx` -- expected: parent table, pager, stale response and action-menu tests pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: no TypeScript errors.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Parent-First Read Model**

- Tạo projection phân trang từ liên kết active, giữ scope tenant/năm học ở server.
  [`parents.service.ts:94`](../../apps/api/src/modules/parents/parents.service.ts#L94)

- Expose read model qua boundary roster đã có authorization.
  [`roster.controller.ts:151`](../../apps/api/src/modules/roster/roster.controller.ts#L151)

**Table And Focused Actions**

- Tách parent fetch khỏi student roster, giữ stale guard và reconcile current query/page.
  [`roster-workspace.tsx:452`](../../apps/web/src/roster/roster-workspace.tsx#L452)

- Render bảng parent-first, aggregate con/lớp và menu mở chi tiết từng link.
  [`roster-workspace.tsx:2459`](../../apps/web/src/roster/roster-workspace.tsx#L2459)

- Bổ sung table width và compact child-list theo visual language danh bộ hiện có.
  [`index.css:1299`](../../apps/web/src/index.css#L1299)

**Contracts And Regression Coverage**

- Khai báo DTO minimum cho API/UI dùng chung.
  [`index.ts:44`](../../packages/contracts/src/index.ts#L44)

- Kiểm tra tenant/year scope, paging, search và active-link aggregation trên PostgreSQL.
  [`roster.integration.test.ts:286`](../../apps/api/src/integration/roster.integration.test.ts#L286)

- Kiểm tra table, stale fetch, paging và accessible detail action ở portal Admin.
  [`roster-workspace.test.tsx:23`](../../apps/web/src/roster/roster-workspace.test.tsx#L23)
