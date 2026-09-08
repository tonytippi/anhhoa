---
title: 'Mockup Cấu hình trường'
type: 'feature'
created: '2026-09-07'
status: 'done'
baseline_commit: 'f3047870d2f598fb92a052b725e084cea7fb05e9'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin chưa có điểm vào hay bản mẫu riêng để review hồ sơ Trường, lịch, BankAccount và các policy typed/versioned. Các policy hiện được yêu cầu qua UX spine nhưng chưa có bề mặt thể hiện active/proposed, effective date, audit, conflict và server impact.

**Approach:** Tạo một mockup Admin `school-settings.html` dùng shared shell và ngữ cảnh Trường Ánh Hoa/năm học 2026-2027. Trang dùng bảng cho version history và BankAccount, form/dialog cho proposal; hiển thị fact nghiệp vụ ngắn, state server-returned và đối soát thao tác mà không thay đổi domain policy hoặc tính toán trên client.

## Boundaries & Constraints

**Always:** Dùng static HTML direct-open, `data-admin-route="settings"`, `../prototype.css`, `admin-shell.js`, `../prototype.js`, skip link và shell Admin hiện có. Mỗi route/section có Trường Ánh Hoa rõ ràng; default copy Vietnamese-first, không hiện enum English, internal ID/API term hoặc policy implementation detail. Hiển thị profile, calendar, FinancePolicy, BankAccount, attendance, handover, Parent-access và policy history bằng typed fields đã được contract. Mỗi proposal có active value, effective date, reason khi cần, server-returned impact, error/conflict state và audit disclosure. BankAccount list có tìm/lọc/sắp xếp/trang; chỉ account đang hiệu lực cùng Trường mới dùng cho Invoice mới, inactive/history snapshot vẫn đọc được, không hard-delete. Dirty/pending form chặn School switch; high-impact submit dùng named confirmation và Operation reconciliation, không retry trước outcome kết thúc.

**Ask First:** Đổi FinancePolicy fields/reversal mode, calendar rule, attendance evidence mode, handover behavior, Parent retention, BankAccount lifecycle/eligibility, authorization/capability, effective interval, API hoặc fixture nghiệp vụ.

**Never:** Không để browser tính working day, money, policy result hay invoice eligibility; không dùng JSON/key-value editor; không để policy mới âm thầm ghi đè active/past snapshot; không expose Finance setup cho Parent; không xóa BankAccount/history, không dùng BankAccount inactive/cross-School, không gợi ý thay đổi Invoice issued snapshot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Xem cấu hình | School Admin mở Cấu hình trường | Header nêu Trường/năm học; mỗi typed domain hiển thị active value, effective date và hành động được cấp quyền. | Không có quyền hoặc không có dữ liệu giữ safe context, không hiển thị dữ liệu Trường khác. |
| Đề xuất policy/calendar | Admin nhập effective date/reason có xung đột | Form đồng thời giữ active/proposed, error summary focus/link field và server impact. | Không báo đã đổi trước server outcome; conflict giữ dữ liệu nhập để sửa. |
| BankAccount | Admin lọc/list/tạo/ngừng dùng tài khoản | Bảng URL-backed nêu ngân hàng, chủ tài khoản, trạng thái, hiệu lực và action ngắn. | Tài khoản inactive chỉ là lịch sử; action xác nhận nêu rõ không dùng cho hóa đơn mới, không delete. |
| Timeout proposal/lifecycle | Mutation high-impact chưa có outcome | Dialog lưu thao tác, khóa submit/retry và yêu cầu đối soát. | Pending/unknown vẫn khóa; terminal server mock outcome mới render version/account state và mở thao tác tiếp. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html` -- trang mới: profile, calendar, FinancePolicy, BankAccount và typed operational/Parent policies.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- thêm navigation `Cấu hình trường` đúng destination và active state `settings`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html` -- thay card chưa có thao tác bằng entry point thật.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- tái sử dụng dirty guard/dialog/Operation; thêm settings URL list/render/error behavior tối thiểu nếu cần.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- thêm inventory, entry point và boundary settings.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- behavioral matrix kiểm tra URL BankAccount list, error focus, switch guard và reconciliation.

## Tasks & Acceptance

**Execution:**
- [x] `.../admin/school-settings.html` -- tạo Settings workspace table-first/typed policy -- cho phép review các boundary domain và state versioned.
- [x] `.../admin/admin-shell.js`, `.../admin/admin-staff.html` -- nối sidebar/CTA tới destination mới -- loại bỏ entry point placeholder/link chết.
- [x] `.../mockups/prototype.js` -- hỗ trợ state interaction settings cần thiết -- giữ safety semantics dùng chung.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- đồng bộ coverage -- phản ánh entry/behavior mới.
- [x] `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- kiểm tra matrix behavior -- tránh regression chỉ qua static copy.

**Acceptance Criteria:**
- Given School Admin mở Cấu hình trường, when xem từng domain, then active/proposed/effective/audit fact rõ, tiếng Việt ngắn, không lộ kỹ thuật mặc định và không có policy free-form.
- Given Admin thao tác policy hoặc BankAccount, when gặp validation, conflict, inactive snapshot hay timeout, then UI giữ server context, focus/error/reconciliation đúng và không cho optimistic/retry unsafe state.
- Given Admin mở BankAccount list, when tìm/lọc/sắp xếp/chọn trang, then URL/table/empty state cùng phạm vi; inactive account không có action dùng cho Invoice mới hoặc delete.
- Given Admin chuyển Trường khi form dirty/pending, when chọn chuyển hay bỏ thay đổi, then guard nêu hành động an toàn và discard reset form; pending outcome vẫn yêu cầu đối soát.

## Design Notes

Nhãn bề mặt: `Đang áp dụng`, `Dự kiến áp dụng`, `Ngừng dùng`, `Đang hiệu lực`, `Thông tin đối soát`. Bảng dùng cho version/account; card chỉ tóm tắt policy hiện hành hoặc cảnh báo. Policy proposal là thay đổi có hiệu lực, không phải công tắc cục bộ: active và proposed luôn cùng thấy khi có conflict. BankAccount lịch sử còn đọc để hiểu snapshot nhưng không là lựa chọn mới.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: shell hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: interaction hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html` -- expected: HTML hợp lệ.
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: matrix behavior pass.

**Manual checks:**
- Mở Settings từ sidebar/CTA, thử direct anchors, BankAccount URL controls, error summary, school switch guard, pending/terminal reconciliation và disclosure.
- Kiểm tra bảng trên viewport hẹp, keyboard focus, Escape và return focus của dialog.
