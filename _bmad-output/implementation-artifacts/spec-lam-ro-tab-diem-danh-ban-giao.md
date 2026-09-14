---
title: 'Làm rõ tab Điểm danh và bàn giao'
type: 'refactor'
created: '2026-09-13'
status: 'done'
review_loop_iteration: 0
baseline_commit: '31c95b35347af09d978215ed2d6e0413ffa3e97e'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/specs/spec-passionedu/SPEC.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tab `Điểm danh & bàn giao` đang biến hai lựa chọn evidence đơn giản cho điểm danh và trả trẻ thành policy versioned phức tạp. Người xem phải đọc bảng sáu cột, proposal và lịch sử thay vì thấy rõ Teacher có phải chụp ảnh khi ghi nhận từng hành động hay không.

**Approach:** Thiết kế lại tab thành hai cấu hình ngắn, đồng cấp: ảnh khi ghi `PRESENT` và ảnh khi Teacher ghi giờ trả trẻ. Mỗi cấu hình chỉ có lựa chọn `Bắt buộc`/`Tùy chọn` và action thay đổi; Teacher vẫn ghi nhận trong Teacher portal, Parent chỉ nhận thông báo/DTO được authorize.

## Boundaries & Constraints

**Always:** Attendance và handover evidence chỉ nhận mode `REQUIRED` hoặc `OPTIONAL`. `REQUIRED` chỉ bắt buộc ảnh khi Teacher ghi `PRESENT` hoặc xác nhận `pickedUpAt` tương ứng. Teacher portal là surface duy nhất để ghi attendance hoặc `pickedUpAt`; server vẫn authorize, validate, snapshot/audit và reconcile Operation. Handover là operational reference: Teacher ghi giờ trả thực tế, Parent chỉ nhận event/DTO được authorize, không phải pickup authorization hay tính phí tự động.

**Ask First:** Hỏi trước khi thêm policy field/domain value ngoài `REQUIRED`/`OPTIONAL`, thay đổi evidence access/retention, quyền/capability, API/schema hoặc đưa thao tác Teacher vào Admin.

**Never:** Không dùng text input/free-form JSON cho evidence setting; không optimistic xác nhận policy; không tạo cutoff/grace/block handover policy, không suy diễn phí đón muộn; không lộ evidence/Staff/internal facts cho Parent; không sửa historical final artifacts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở tab | Hai evidence setting active | Hai card ngắn nêu rõ ảnh có bắt buộc khi ghi có mặt và khi xác nhận trả trẻ | Không có bảng cột dài hay policy handover khác |
| Đổi setting | Chọn `OPTIONAL` cho attendance hoặc handover | Named confirmation rồi Operation reconciliation; chỉ terminal result mới cập nhật đúng cấu hình | Validation giữ lựa chọn và focus error |
| Teacher ghi vận hành | School Admin đang xem tab | Không có roster, attendance/handover mutation hay chọn trẻ trong Admin | Điều hướng/copy dẫn tới Teacher portal, không cấp quyền |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:61-65` -- thay bảng và free-text proposal bằng hai evidence setting card tối giản.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:359-371` -- khởi tạo Settings tabs; bind change/confirmation cho từng evidence setting, không thêm state optimistic.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs:104-120` -- thay test proposal cũ bằng lifecycle evidence setting attendance/handover và absence of Admin operational mutation.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:124-166` -- giữ Settings four-tab boundary và bổ sung contract chống bảng/free-text/cutoff policy cũ.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:59,75-76,101,107,110,141-144` -- Admin/Teacher boundary và evidence retention/access; cần decision artifact trước khi đồng bộ wording final.
- `_bmad-output/planning-artifacts/epics-passionedu.md:598-606,631-639,699-707,714-730` -- attendance evidence is canonical; handover evidence is new requirement needing decision; chỉ đọc, không sửa.

## Tasks & Acceptance

**Execution:**
- [ ] Decision artifact -- xác định handover photo evidence mode, access, retention, Parent projection và API/schema impact -- giải quyết requirement mới trước khi sửa final sources.
- [ ] `mockups/admin/school-settings.html` -- render attendance/handover evidence card, mỗi card có `Bắt buộc`/`Tùy chọn` -- làm nhiệm vụ của từng audience dễ hiểu.
- [ ] `mockups/prototype.js` -- bind từng evidence setting change/confirmation vào lifecycle Operation hiện có -- giữ idempotency/reconciliation UX.
- [ ] `test-school-settings-ux.mjs` -- cover attendance/handover evidence setting lifecycle và absence of Admin operational mutation -- bảo toàn semantic boundary.
- [ ] `test-rendered-mockup-contracts.mjs` -- assert simple evidence settings and reject six-column/free-text/cutoff policy surface -- chống regression UX/domain.

**Acceptance Criteria:**
- Given School Admin opens `Điểm danh & bàn giao`, when the panel renders, then they can identify whether Teacher needs an image for `PRESENT` and for confirmed handover without reading a table.
- Given Admin changes either evidence setting, when they submit a valid choice, then the mockup requests named confirmation, reconciles an Operation, and updates only that setting after terminal confirmation.
- Given server validation occurs, when reconciliation returns it, then the selected value remains visible with accessible error focus and no local override.
- Given Admin uses this panel, when inspecting controls, then no Student roster, attendance write, `pickedUpAt` input or fee calculation is present.

## Design Notes

Each card starts with a teacher-facing consequence, not a domain label: `Khi ghi có mặt, giáo viên phải đính kèm ảnh.` and `Khi xác nhận trả trẻ, giáo viên phải đính kèm ảnh.` A compact `Thay đổi` action reveals only `Bắt buộc` and `Tùy chọn`. The handover card also says that Teacher records the actual return time and Parent receives the authorized notification after server confirmation.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: Settings tabs, simple attendance/handover evidence setting lifecycle and Admin boundary pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: static Settings/policy contracts pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: no whitespace error.

## Suggested Review Order

**Product And Security Contract**

- Decision fixes the required/evidence/retention/Parent-disclosure boundary before UI work.
  [`decision-handover-photo-evidence-2026-09-14.md:1`](decision-handover-photo-evidence-2026-09-14.md#L1)

- Canonical requirements make handover evidence a protected, server-enforced capability.
  [`prd.md:230`](../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md#L230)

- Architecture preserves tenant authorization, two-month cleanup and minimal Parent handover projection.
  [`ARCHITECTURE-SPINE.md:136`](../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md#L136)

**Admin And Teacher Flow**

- Settings exposes two simple evidence choices instead of a multi-column policy table.
  [`school-settings.html:61`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L61)

- Terminal Operation reconciliation alone refreshes a setting's confirmed display.
  [`prototype.js:82`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L82)

- Teacher handover fixture requires protected image evidence before confirmation.
  [`teacher.html:65`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html#L65)

**Regression Protection**

- Settings test covers each evidence setting's confirmed transition.
  [`test-school-settings-ux.mjs:104`](test-school-settings-ux.mjs#L104)

- Teacher test requires evidence controls for every required handover fixture row.
  [`test-teacher-attendance-ux.mjs:198`](test-teacher-attendance-ux.mjs#L198)
