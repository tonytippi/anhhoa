---
title: 'Chuyển điểm danh sang cổng Giáo viên'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: 'e86d5dd7f4713a8c480b227ed35380b69314eb12'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin workspace vẫn có sidebar, dashboard, route và mutation mock cho điểm danh, trong khi cổng Giáo viên đã là bề mặt thực hiện điểm danh theo School/Class/date và contract mockup nêu rõ Admin không có điểm vào mutation lớp học.

**Approach:** Loại bỏ toàn bộ bề mặt điểm danh vận hành khỏi Admin và cập nhật navigation/test/coverage tương ứng. Giữ chính sách điểm danh typed/versioned trong Cấu hình trường cho School Admin; không thay đổi thao tác, phân quyền hay fixture điểm danh của cổng Giáo viên.

## Boundaries & Constraints

**Always:** Xóa sidebar entry, dashboard summary/table/route/filter/action Admin cho điểm danh, cũng như logic JS chỉ phục vụ route đó. Admin vẫn giữ Tổng quan, đơn nghỉ, bàn giao, Danh bộ, Cấu hình trường và Tài chính. Cổng Giáo viên vẫn là điểm duy nhất mô phỏng nhận trẻ/điểm danh theo lớp được phân công, ngày và capability hiệu lực. Giữ attendance policy trong `school-settings.html` vì School Admin cấu hình policy chứ không ghi attendance.

**Ask First:** Đổi Teacher assignment/capability, policy evidence, leave conflict, School Admin quyền review attendance records, hoặc thêm luồng read-only attendance mới cho Admin.

**Never:** Không chuyển mutation điểm danh sang Parent/Ops; không để Admin link/hash ẩn vẫn mở danh sách hoặc dialog điểm danh; không xóa policy điểm danh, evidence contract hay trạng thái server-returned của Teacher; không thay browser state bằng authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Admin mở Tổng quan/sidebar | Admin điều hướng workspace | Không thấy `Điểm danh`, summary điểm danh, bảng tiến độ hay hash route attendance; các link còn lại hợp lệ. | Hash `#attendance` cũ không mở bề mặt thao tác; route an toàn là Tổng quan. |
| Giáo viên mở lớp hôm nay | Teacher có assignment/capability hiệu lực | Danh sách lớp vẫn có trạng thái server-returned và action nhận trẻ theo contract Teacher. | Quyền/binding bị thu hồi giữ safe state hiện có. |
| School Admin mở Cấu hình trường | Xem policy typed/versioned | Vẫn xem/chỉnh đề xuất policy điểm danh, không có danh sách học sinh hay mutation attendance. | Validation/Operation settings giữ behavior hiện có. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html:22-50` -- summary, progress table và route điểm danh Admin cần retire; giữ leave/handover/settings.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js:11-14,29` -- bỏ nav/fragment attendance và cập nhật workspace hash handling.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:247-304` -- bỏ/giới hạn queue render và evidence dialog chỉ cho Admin attendance, giữ leave/handover/Teacher behavior.
- `_bmad-output/implementation-artifacts/test-admin-workspace-queue.mjs` -- đổi behavior matrix để không kỳ vọng attendance Admin; giữ coverage leave/handover/reconciliation còn lại.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html:21-34` -- read-only evidence Teacher remains authoritative mockup reference.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:19-21` -- giữ attendance policy, không thêm operation attendance.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:10,30-32` -- cập nhật review inventory/ownership wording.

## Tasks & Acceptance

**Execution:**
- [ ] `.../admin/admin-staff.html`, `.../admin/admin-shell.js` -- retire toàn bộ Admin attendance surface/navigation -- Teacher là entry thao tác duy nhất.
- [ ] `.../mockups/prototype.js` -- bỏ route/evidence behavior không còn reachable từ Admin, giữ generic/reconciliation behavior cần cho Teacher, leave và handover -- tránh dead route/dialog.
- [ ] `.../test-admin-workspace-queue.mjs` -- cập nhật behavioral matrix -- kiểm tra Admin không khôi phục attendance qua hash và leave/handover vẫn hoạt động.
- [ ] `.../mockups/MOCKUP-COVERAGE.md` -- nêu rõ ownership điểm danh Teacher và policy-only ở Settings -- đồng bộ scope review.

**Acceptance Criteria:**
- Given Admin duyệt sidebar, Tổng quan hoặc hash cũ, when tìm điểm danh, then không có link, table, queue hay mutation attendance; `#attendance` không render bề mặt thao tác.
- Given Teacher mở lớp hôm nay, when ghi nhận nhận trẻ, then action/trạng thái Teacher vẫn theo assignment/capability và server-confirmed mock contract hiện có.
- Given School Admin mở Settings, when xem policy điểm danh, then chỉ có policy typed/versioned, không có Student list hay attendance mutation.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: shell hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: behavior hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html` -- expected: HTML hợp lệ.
- `node _bmad-output/implementation-artifacts/test-admin-workspace-queue.mjs && node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: matrix pass.

**Manual checks:**
- Mở Admin và Teacher trực tiếp; xác nhận hash cũ `#attendance` không đưa tới action Admin, còn Teacher giữ lớp/ngày/nhận trẻ và Settings chỉ giữ policy.
