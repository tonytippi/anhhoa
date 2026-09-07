---
title: 'Chuẩn hóa UX Admin workspace và hàng đợi'
type: 'refactor'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
baseline_commit: '04d1cfa3d13b7a6952dbdfa7d2115d72b5516dcf'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin hiện có hai mockup tổng quan vận hành khác chuẩn, đồng thời workspace mới còn lộ mã nội bộ, dùng card thay cho danh sách tác vụ và có một số đường dẫn/hành động không dẫn tới thao tác vận hành đủ ngữ cảnh.

**Approach:** Chuẩn hóa Admin workspace và hàng đợi thành một bề mặt dùng shared shell, tiếng Việt ngắn, table-first cho danh sách cần xử lý. Các điểm vào điểm danh, đơn nghỉ và bàn giao phải cho phép review mockup theo lớp/ngày/trạng thái với xác nhận và đối soát an toàn, nhưng không thay đổi nghiệp vụ server-authoritative.

## Boundaries & Constraints

**Always:** Giữ Admin shell, static HTML direct-open, School context, ngày vận hành và các link hiện hữu tới Danh bộ/Tài chính. Chỉ hiển thị tiếng Việt ngắn trên bề mặt mặc định; không hiện mã `AH-*`, `CR-*`, `MH-*`, trạng thái English hoặc thuật ngữ API/lifecycle. Ưu tiên bảng cho lớp, học sinh, đơn nghỉ và bàn giao; card chỉ dùng cho tổng quan hoặc cảnh báo. Hàng đợi dẫn tới danh sách đã lọc theo ngày/lớp/trạng thái. Mutation mô phỏng phải dùng named confirmation, `data-idempotent-action` khi high-impact, không cho retry trước khi kiểm tra kết quả; các giá trị/khả dụng hiển thị là kết quả máy chủ.

**Ask First:** Đổi policy điểm danh, xin nghỉ, bàn giao, quyền, lịch vận hành, API, workflow approval, hoặc tạo chức năng domain mới ngoài mockup.

**Never:** Không giữ hai visual system cho cùng một workspace; không tạo link tới fragment/destination không tồn tại; không tính phí trễ hoặc thay đổi trạng thái attendance/leave/handover cục bộ; không lộ dữ liệu hay evidence không cần thiết cho thao tác.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Điều phối buổi sáng | Admin mở Tổng quan của Trường Ánh Hoa ngày 05/09 | Có School/date rõ ràng, số lượng cần xử lý và bảng tiến độ theo lớp; mỗi action mở hàng đợi đúng bộ lọc. | Không có dữ liệu thì giữ ngữ cảnh ngày/trường và nêu trạng thái rỗng, không suy diễn vắng mặt. |
| Điểm danh | Lớp còn học sinh chưa ghi nhận hoặc có đơn nghỉ/lịch xung đột | Bảng học sinh hiển thị trạng thái chữ, lý do không thể ghi nhận và action phù hợp. | Timeout vô hiệu gửi lại, chuyển sang kiểm tra kết quả rồi mới cho thao tác tiếp. |
| Duyệt đơn nghỉ | Đơn đang chờ xử lý | Danh sách có học sinh, ngày nghỉ, trạng thái và action mở xác nhận nêu rõ đối tượng/kết quả. | Validation hoặc thay đổi đồng thời giữ dữ liệu máy chủ để review lại; requester không có quyền không thấy action. |
| Bàn giao | Học sinh chưa có giờ đón | Danh sách theo lớp/ngày cho phép ghi nhận từng học sinh qua xác nhận có tên và thời điểm. | Thiếu quyền, đã ghi nhận hoặc lỗi server nêu lý do và làm mới hàng, không gợi ý tạo phí. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-operational-queue.html:1-2` -- mockup legacy inline cần retire hoặc chuyển thành entry nhất quán tới shared workspace; không giữ sidebar/CSS riêng.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html:12-204` -- workspace hiện có; thay card summary/ID kỹ thuật bằng các bảng queue, ngữ cảnh route và action an toàn.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js:16-36` -- shared named navigation, skip link và active route; sửa/loại bỏ destination không có trong mockup.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- token/layout dùng chung; bổ sung focus-visible 3px cho mọi control nếu thiếu.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:5-110` -- giữ dialog focus trap, school-switch guard và idempotent/reconciliation behavior; tái sử dụng cho action queue.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- đồng bộ inventory/mô tả khi entry legacy được hợp nhất.

## Tasks & Acceptance

**Execution:**
- [x] `.../admin/admin-operational-queue.html` -- retire hoặc chuyển hướng rõ ràng sang workspace shared shell -- loại bỏ dashboard legacy trùng lặp.
- [x] `.../admin/admin-staff.html` -- chuẩn hóa overview, attendance, leave và handover theo bảng, copy tiếng Việt ngắn, context route và action có xác nhận -- biến các summary thành task destination reviewable.
- [x] `.../admin/admin-shell.js`, `.../prototype.css`, `.../prototype.js` -- bảo đảm navigation không link chết, focus-visible và interaction queue tái sử dụng semantics an toàn -- giữ accessibility/Operation conventions nhất quán.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- cập nhật mô tả/entry point sau khi hợp nhất -- giữ coverage inventory đúng.

**Acceptance Criteria:**
- Given Admin mở Tổng quan hoặc một hàng đợi, when quét heading, bảng và action, then School/date, nhãn tiếng Việt, trạng thái chữ và destination theo filter đều rõ ràng, không lộ mã kỹ thuật/English mặc định.
- Given một bản ghi điểm danh, nghỉ hoặc bàn giao cần thao tác, when Admin mở action, then dialog nêu bản ghi/hệ quả, giữ focus keyboard và dùng đối soát trước retry sau timeout.
- Given reviewer dùng sidebar hoặc dashboard card, when chọn một đích, then không có link chết; destination hợp lệ hoặc được nêu rõ là chưa có thao tác.
- Given viewport hẹp hoặc dùng bàn phím, when bảng và controls được dùng, then bảng giữ identifying columns/horizontal scroll và mọi control có focus-visible rõ ràng.

## Design Notes

Tổng quan chỉ là nơi ưu tiên công việc: số lượng, tín hiệu và đường dẫn được lọc sẵn. Từng queue mới là nơi quyết định, vì vậy hiển thị record bằng table-first. Dùng `Đã ghi nhận`, `Chưa ghi nhận`, `Đang chờ duyệt`, `Đã bàn giao` thay cho trạng thái/mã kỹ thuật; chi tiết audit chỉ hiện khi được mở có chủ đích.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: JavaScript shell hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript tương tác hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-operational-queue.html _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html` -- expected: HTML hợp lệ.

**Manual checks:**
- Mở overview và từng fragment queue, kiểm tra School/date, lọc lớp/ngày/trạng thái, link quay lại và không có mã kỹ thuật ở bề mặt mặc định.
- Kiểm tra skip link, tab focus, dialog Escape/return focus, school-switch guard và timeout reconciliation cho action thao tác.
