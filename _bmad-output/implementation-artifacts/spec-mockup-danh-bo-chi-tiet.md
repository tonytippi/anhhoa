---
title: 'Mockup chi tiết Danh bộ PassionEdu'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
baseline_commit: '97805fadb2b7ed428addfc0fb13720d149d720ba'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics-passionedu.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Danh bộ trong mockup Admin/Nhân viên mới là phần tóm tắt, chưa đủ để review quy trình thiết lập năm học/lớp, ghi danh có lịch sử, liên kết Phụ huynh, phân công Nhân sự và chuyển lớp/chuyển năm trước khi phát triển.

**Approach:** Tạo các trang mockup Danh bộ độc lập trong `mockups/admin/roster/`, dùng shared Admin shell tại `mockups/admin/`: danh sách danh bộ, thiết lập năm học/lớp, hồ sơ-học sinh/ghi danh, liên kết Phụ huynh, hồ sơ-nhân sự/phân công và wizard chuyển danh bộ. Liên kết từ Admin workspace đi vào từng luồng, giữ fixture Ánh Hoa nhất quán và chỉ mô phỏng kết quả do máy chủ xác nhận.

## Boundaries & Constraints

**Always:** Dùng tiếng Việt có dấu; mọi trang nêu Trường Ánh Hoa và năm học 2026-2027 khi phù hợp; `data-admin-route="roster"` để shell chỉ đánh dấu Danh bộ active. Các file trong `admin/roster/` dùng đường dẫn tương đối tới `../admin-shell.js`, `../../prototype.css`, `../../prototype.js`, không dùng fetch/module/network để VS Code Preview chạy trực tiếp. Giữ Student và StudentEnrollment tách biệt; mã học sinh do máy chủ sinh, bất biến/không tái sử dụng; lifecycle chỉ dùng `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`. Form phải thể hiện effective date, lỗi server cạnh field/error summary, audit/history, Operation reconciliation và switch guard khi cần. Bảng có caption, nội dung School-scoped và responsive treatment hiện có.

**Ask First:** Thay đổi lifecycle ghi danh, ràng buộc active SchoolYear, Parent authorization, Staff role/capability hay UX spine; triển khai mockup Cấu hình trường và policy versioned đã được tách sang work riêng.

**Never:** Không tạo mã học sinh trên client, local placeholder sau khi server từ chối, hard-delete record có lịch sử, Parent login/role tự động từ pending link, Staff login/role từ StaffProfile/assignment, force-move record bị server preview loại, hoặc retry mutation timeout trước đối soát thao tác.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Danh sách danh bộ | Năm học 2026-2027, lọc lớp/lifecycle | Danh sách có mã server sinh, lớp, lifecycle, Parent link và ngày hiệu lực. | Không hiển thị dữ liệu từ Trường khác hay suy luận eligibility tại client. |
| Tạo SchoolYear/lớp | Một SchoolYear đang active | Form thông báo chỉ có một năm học active và lớp thuộc đúng năm học. | Giữ dữ liệu nhập, focus error summary và hiển thị field error khi ngày/active conflict. |
| Ghi danh học sinh | Student mới vào lớp hợp lệ | Tách Student profile và enrollment, cho thấy interval `[effectiveFrom, endedOn)`, actor/as-of facts. | Không tạo placeholder; interval/lifecycle invalid do máy chủ trả về. |
| Liên kết Parent pending | Họ tên, email normalized, số điện thoại | Hiển thị pending/active/revoked, tenant-scoped link và audit. | Không cấp login/role; revoke xóa context ở request sau nhưng lịch sử còn đọc được. |
| Phân công Staff | Staff profile + Class + interval | Tách Staff record, login-role state và class assignment; hiển thị timezone/lý do/audit. | Không ngụ ý password/capability; interval/Cross-School lỗi do server trả về. |
| Chuyển lớp/chuyển năm | Preview batch | Server phân loại chuyển được/không chuyển được, source history và destination mapping. | Confirm idempotent; timeout khóa retry và dẫn đối soát Operation. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- Shared Admin/Nhân viên sidebar, Danh bộ đi tới entry point riêng.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html` -- Workspace cần liên kết CTA Danh bộ sang mockup mới.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- Table, form, dialog, stepper và responsive primitives.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- Confirm/Operation reconciliation dialog chung; không tự đổi domain state.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Ma trận review cần ghi nhận bộ Danh bộ standalone.
- `_bmad-output/planning-artifacts/epics-passionedu.md` -- Epic 2 contract SchoolYear/Class, Enrollment, Parent/Staff và transition; chỉ đọc.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/roster/roster.html` -- Tạo danh sách Danh bộ với filter/year/class/lifecycle và entry links -- làm landing thao tác thực tế.
- [x] `mockups/admin/roster/school-year-classes.html` -- Tạo thiết lập SchoolYear và Class với active boundary, effective date và validation state -- review foundation trước Student enrollment.
- [x] `mockups/admin/roster/student-enrollment.html` -- Tạo hồ sơ Student tách Enrollment/history/lifecycle -- review immutable student code và as-of facts.
- [x] `mockups/admin/roster/student-parent-links.html` -- Tạo quản lý liên kết Parent pending/active/revoked -- review authorization boundary và audit.
- [x] `mockups/admin/roster/staff-assignments.html` -- Tạo hồ sơ Staff và Class assignment effective-dated -- review tách record khỏi login/role.
- [x] `mockups/admin/roster/roster-transition.html` -- Tạo wizard chuyển lớp/chuyển năm/close-year với server preview và Operation -- review historical preservation/concurrency path.
- [x] `mockups/admin/admin-shell.js`, `mockups/admin/admin-staff.html`, `mockups/MOCKUP-COVERAGE.md` -- Nối navigation/CTA và coverage -- đưa reviewer vào đúng luồng từ workspace.

**Acceptance Criteria:**
- Given reviewer mở Danh bộ từ sidebar hoặc workspace, when route load, then `roster.html` hiển thị cùng shared shell và đúng một Danh bộ active.
- Given reviewer đi qua sáu trang Danh bộ, when mở các link liên quan, then Trường, SchoolYear, Student/Staff fixture và back links nhất quán.
- Given server validation/conflict/timeout state, when được xem trong form hoặc wizard, then dữ liệu server-returned còn hiển thị, error focus/Operation guidance rõ và không có optimistic local state.
- Given pending Parent hoặc Staff assignment, when reviewer xem record, then UI không ngụ ý session, login, role hay capability tự phát sinh.
- Given transition preview có record bị loại, when reviewer xem/confirm, then record đó không có action force-move và timeout dẫn đối soát Operation trước retry.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: shared shell hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: dialog behavior hợp lệ.

**Manual checks:**
- Mở toàn bộ page Danh bộ bằng VS Code Preview; xác nhận shell/sidebar/header/skip link render.
- Đi qua các link Danh bộ từ Admin workspace và giữa các page; kiểm tra back link, active route, mobile table scroll và dialog Operation.

## Suggested Review Order

1. `mockups/admin/admin-staff.html` để xác nhận CTA và sidebar vào Danh bộ.
2. `mockups/admin/roster/roster.html`, sau đó `school-year-classes.html` để kiểm tra boundary năm học/lớp.
3. `student-enrollment.html`, `student-parent-links.html` và `staff-assignments.html` để kiểm tra các boundary record/access/history.
4. `roster-transition.html` để kiểm tra preview, excluded records, close-year và đối soát Operation.
