---
title: 'Điều chỉnh bảng danh sách nhân viên'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3c6a1fb'
context:
  - '_bmad-output/implementation-artifacts/spec-danh-sach-nhan-vien-table-first.md'
  - '_bmad-output/implementation-artifacts/spec-danh-sach-phu-huynh-table-first.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Danh sách Nhân viên hiện dùng controls dạng lưới khác Học sinh/Phụ huynh, có caption `Hồ sơ nhân sự` thừa, và gộp số điện thoại vào dòng tên khiến bảng khó quét. Các cột hẹp làm chức danh/trạng thái bị wrap.

**Approach:** Dùng cùng pattern search-first của danh sách Học sinh/Phụ huynh cho controls Nhân viên, bỏ caption thừa, và mở rộng read model/table để hiển thị cột số điện thoại cùng danh sách lớp được phân công. Thiết lập widths/min-width table để các giá trị desktop phổ biến không bị wrap; mobile tiếp tục scroll ngang.

## Boundaries & Constraints

**Always:** Giữ filter server-side hiện có (tìm theo tên/mã/email/số điện thoại, status, primary position, sort), request generation guard, row action menu, pagination và School-scoped authorization. Cột `Lớp` phải là projection server-authoritative của các StaffClassAssignment hiệu lực trong SchoolYear được chọn; không suy ra từ browser state. Hiển thị contact nullable bằng fallback rõ ràng, không literal `null`. Giữ visual language/table-first và responsive horizontal scroll đã được duyệt.

**Ask First:** Dừng nếu cần thay đổi semantics assignment/lifecycle, thêm filter lớp mới, hoặc chọn một SchoolYear khác với ngữ cảnh roster hiện tại cho cột Lớp.

**Never:** Không thay đổi schema, migration, capability, login binding, assignment mutation hay query authorization. Không đưa client-side calculation/aggregation lớp vào thay API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Tìm kiếm | Nhập text rồi submit hoặc clear | Cùng search-first controls như Học sinh/Phụ huynh và reload trang 1 | Giữ error/loading row hiện có |
| Row giáo viên nhiều lớp | Có nhiều assignment hiệu lực SchoolYear chọn | Một cột Lớp hiển thị đủ tên lớp, không suy diễn role/capability | Không wrap tùy tiện; desktop table mở rộng/scroll khi cần |
| Row không có lớp/contact | Không assignment hoặc phone null | Hiển thị `-`, không `null` và không nhét phone vào tên | Không đổi action/pagination |
| Desktop hẹp/mobile | Tổng widths vượt viewport | Desktop cột có min-width chống wrap; mobile scroll ngang | Không làm controls/action menu inaccessible |

</frozen-after-approval>

## Code Map

- `apps/web/src/roster/roster-workspace.tsx:1586-1741` -- controls, staff table, action menu và pager hiện tại; thay hierarchy/columns tại đây.
- `apps/web/src/index.css:1300-1361` -- shared table/filter CSS và staff min-width/mobile controls; giữ language hiện hữu.
- `apps/api/src/modules/roster/roster.service.ts:414-472` -- paged School-scoped staff read model; mở rộng projection lớp theo selected SchoolYear một lần trên server.
- `apps/api/src/modules/roster/roster.controller.ts` -- route query boundary nếu SchoolYear là query selector hợp lệ.
- `packages/contracts/src/index.ts:47-65` -- Staff list query/row contracts.
- `apps/api/src/modules/roster/roster.controller.test.ts` và `apps/api/src/integration/roster.integration.test.ts` -- controller/PostgreSQL coverage for staff list projection.
- `apps/web/src/roster/roster-workspace.test.tsx` -- UI request/table regression coverage.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/index.ts`, `apps/api/src/modules/roster/roster.service.ts`, controller/tests -- return same-School, selected-year assignment class names in each paged staff row without changing authorization or assignment lifecycle.
- [ ] `apps/web/src/roster/roster-workspace.tsx` -- align staff search controls with sibling directories, remove the caption, add phone/class columns and render fallback values.
- [ ] `apps/web/src/index.css` -- size staff columns/min-width to prevent avoidable desktop wrapping while retaining mobile horizontal scroll.
- [ ] `apps/web/src/roster/roster-workspace.test.tsx` -- cover request/query continuity and phone/class row display without breaking menu/pager behavior.

**Acceptance Criteria:**
- Given the Nhân viên tab, when viewing controls, then search uses the same search-first list pattern as Học sinh/Phụ huynh and the `Hồ sơ nhân sự` caption is absent.
- Given a paged staff row, when it has contact and selected-year class assignments, then phone and all assignment class names appear in their own columns; when absent, each cell shows `-`.
- Given long position/status/name/class content on desktop, when the table renders, then columns retain readable widths without ordinary text wrapping; when viewport is too narrow, the table scrolls horizontally.
- Given searches, filters, sorting, pagination and row edit actions, when using the adjusted table, then they retain their existing School-scoped behavior.

## Design Notes

The directory’s identity scan is `Họ tên | Số điện thoại | Lớp | Chức danh | Trạng thái | Thao tác`; employee code remains a secondary identifier below the name. Class names are a current selected-year read projection only, not a statement of login access or operational capability.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- roster.controller.test.ts` -- expected: staff list controller/query coverage passes.
- `pnpm --filter @passionedu/api test:integration -- roster.integration.test.ts` with `.env.test` -- expected: tenant/year class projection coverage passes.
- `pnpm --filter @passionedu/api typecheck` -- expected: API contract compiles.
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx` -- expected: staff directory UI regressions pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: UI contract compiles.

## Suggested Review Order

**SchoolYear Class Projection**

- Validate the selected SchoolYear belongs to the School before loading active assignment classes.
  [`roster.service.ts:412`](../../apps/api/src/modules/roster/roster.service.ts#L412)

- Return only currently effective assignment class names with the paged Staff read model.
  [`roster.service.ts:452`](../../apps/api/src/modules/roster/roster.service.ts#L452)

**Directory Presentation**

- Include selected SchoolYear in every staff list request and reload it when the year changes.
  [`roster-workspace.tsx:479`](../../apps/web/src/roster/roster-workspace.tsx#L479)

- Use search-first controls and distinct phone/class table columns without the redundant caption.
  [`roster-workspace.tsx:1587`](../../apps/web/src/roster/roster-workspace.tsx#L1587)

- Keep desktop staff cells readable and no-wrap while retaining horizontal scroll on narrow viewports.
  [`index.css:1302`](../../apps/web/src/index.css#L1302)

**Regression Coverage**

- Verify SchoolYear forwarding and current-class tenant isolation at controller/PostgreSQL boundaries.
  [`roster.controller.test.ts:47`](../../apps/api/src/modules/roster/roster.controller.test.ts#L47)

- Verify the Staff table renders dedicated phone and class values.
  [`roster-workspace.test.tsx:250`](../../apps/web/src/roster/roster-workspace.test.tsx#L250)
