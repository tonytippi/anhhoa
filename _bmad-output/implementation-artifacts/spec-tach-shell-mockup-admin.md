---
title: 'Tách shell dùng chung cho mockup Admin'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '58b50fb375c5252f16fc99856f7254faad2540d3'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bốn mockup Admin/Nhân viên lặp lại sidebar và header, làm navigation, School context và identity có nguy cơ lệch nhau khi chỉnh sửa.

**Approach:** Tạo một script JavaScript dùng chung render shell Admin/Nhân viên. Mỗi trang HTML chỉ khai báo route active và main content; script tạo skip link, sidebar, School context header và avatar nhất quán khi mở bằng VS Code Preview hoặc trực tiếp bằng trình duyệt.

## Boundaries & Constraints

**Always:** Giữ mockup HTML tĩnh mở được bằng VS Code Preview và trực tiếp từ file system; nạp `admin-shell.js` bằng thẻ `<script defer src="admin-shell.js"></script>` thông thường, cùng cấp với HTML. Không dùng `type="module"`, `fetch`, import động hay API yêu cầu HTTP origin. Dùng `prototype.css` và `prototype.js` hiện có; toàn bộ copy tiếng Việt có dấu; sidebar giữ tất cả destinations/capability hiện có, `aria-current` đúng trang, skip link trỏ đến `#main`, và header luôn hiển thị Ánh Hoa cùng Năm học 2026-2027. Các liên kết hash của Admin và links giữa trang finance không được thay đổi hành vi.

**Ask First:** Tách shell Parent/Ops hoặc thay đổi cấu trúc visual/navigation được chốt trong UX spine.

**Never:** Không thêm framework, build step, server-side include, `type="module"`, `fetch` HTML runtime hoặc phụ thuộc network/extension-specific API; không chuyển quyền/capability/money/lifecycle sang client; không sửa mock mốc cũ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin workspace | `data-admin-route="overview"` | Sidebar có Tổng quan active, header và skip link xuất hiện trước main. | Route không xác định không đánh dấu link nào active. |
| Trang finance riêng | `data-admin-route="receivables"`, `runs` hoặc `invoice-review` | Cùng shell render, link active và các liên kết nội bộ đúng trang. | Trang vẫn giữ main content nếu script không tìm thấy host shell. |
| Mở bằng VS Code Preview | Preview mở một trong bốn HTML | Script cùng thư mục render sidebar/header mà không cần web server. | JavaScript không phụ thuộc ES module, module import, request ngoài hoặc API riêng của extension. |
| Mở trực tiếp | URL `file://.../*.html` | Không cần fetch hoặc server để render sidebar/header. | JavaScript không phụ thuộc module import hay request ngoài. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html` -- Trang workspace chính cần chuyển sang shell host.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- Route Khoản thu dùng shell chung.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- Route Đợt thu dùng shell chung.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html` -- Route Rà soát hóa đơn dùng shell chung.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-shell.js` -- Script `defer` cổ điển mới sở hữu markup sidebar/header Admin/Nhân viên, tương thích VS Code Preview.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- Hành vi dialog dùng chung, phải vẫn bind sau khi shell render.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin-shell.js` -- Tạo renderer shell Admin/Nhân viên bằng script `defer` cổ điển dựa trên `data-admin-route` -- loại bỏ markup navigation/header lặp lại mà vẫn chạy trong VS Code Preview.
- [x] `mockups/admin/admin-staff.html`, `mockups/admin/receivable-configuration.html`, `mockups/admin/invoice-generation.html`, `mockups/admin/invoice-detail-review.html` -- Dùng shell host và route declaration -- giữ main content/links riêng từng trang.
- [x] `mockups/prototype.js` -- Bảo đảm bind dialog không bỏ sót control được shell render -- giữ accessibility behavior hiện có.
- [x] `mockups/MOCKUP-COVERAGE.md` -- Ghi nhận shell Admin/Nhân viên dùng chung -- hỗ trợ reviewer hiểu cấu trúc mockup.

**Acceptance Criteria:**
- Given bất kỳ trang Admin/Nhân viên nào, when mở bằng VS Code Preview hoặc trực tiếp, then sidebar, header, avatar và skip link được render đầy đủ từ `admin-shell.js` mà không cần web server.
- Given từng route, when sidebar render, then đúng một navigation link có `aria-current="page"` và các link finance vẫn đi đúng file/hash hiện có.
- Given module dùng chung bị rà soát, when thay đổi nhãn/route sidebar, then chỉ cần thay đổi một file nguồn.
- Given dialog action được mở sau khi shell render, when đóng bằng Escape hoặc nút Hủy, then focus/accessibility behavior hiện có vẫn hoạt động.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-shell.js` -- expected: script shell hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: hành vi shared dialog hợp lệ.

**Manual checks:**
- Mở từng trang Admin/Nhân viên bằng VS Code Preview và từ `review.html`, kiểm tra sidebar/header, active route và skip link.
- Kiểm tra các link Khoản thu, Đợt thu, Rà soát hóa đơn và Thu tiền/Công nợ qua lại giữa các trang.

## Suggested Review Order

1. Mở `mockups/admin/admin-staff.html` để xác nhận hash route nội bộ, shell và hộp thoại đổi ngữ cảnh.
2. Mở `mockups/admin/receivable-configuration.html`, `mockups/admin/invoice-generation.html` và `mockups/admin/invoice-detail-review.html` từ `review.html` để kiểm tra active link và destinations tài chính.
3. Mở trực tiếp từng tệp qua VS Code Preview hoặc `file://`, kiểm tra skip link, Escape, focus trap và focus return của hộp thoại.
