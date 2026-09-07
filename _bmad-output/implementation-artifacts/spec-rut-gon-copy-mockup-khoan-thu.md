---
title: 'Rút gọn copy mockup Khoản thu'
type: 'refactor'
created: '2026-09-07'
status: 'in-review'
baseline_commit: '77ba9af5b10056f3fbf1cd80a6d131d7c365d901'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mockup Khoản thu dùng nhiều câu giải thích kỹ thuật trên phần giao diện chính, khiến cảm giác như tài liệu đặc tả thay vì ứng dụng vận hành quen thuộc.

**Approach:** Rút gọn toàn bộ copy hiển thị thành nhãn, trạng thái và hướng dẫn ngắn theo cách dùng của màn hình danh sách khoản thu Kidsonline trong ảnh tham khảo. Giữ những fact nghiệp vụ cần nhìn thấy, chuyển chi tiết kỹ thuật ra disclosure hoặc helper text ngắn.

## Boundaries & Constraints

**Always:** Giữ nguyên cấu trúc catalog, groups, cột dữ liệu, URL mock, pagination, các state, outbound links và ranh giới nghiệp vụ hiện có. Dùng tiếng Việt rõ, ngắn và nhất quán: `Danh sách khoản thu`, `Thêm khoản thu`, `Nhóm khoản thu`, `Đơn giá`, `Đơn vị`, `Trạng thái`, `Tùy chọn`, `Đang hoạt động`, `Ngừng áp dụng`. Giữ VND nguyên, mã khoản thu, audit tối thiểu và trạng thái có text. Các giải thích server/Operation/PREPAID/snapshot chỉ còn một câu ngắn ở nơi cần thiết hoặc trong disclosure.

**Ask First:** Đổi cấu trúc màn hình, cột, workflow tài chính, quyền/capability, tên domain contract hoặc thay đổi mockup khác ngoài Khoản thu.

**Never:** Không sao chép branding, copy nguyên văn, icon, màu hoặc interaction của Kidsonline; không xóa các boundary tài chính cần thiết, làm copy hiểu là client tự tính/cập nhật state, hoặc thay đổi link `invoice-generation.html` và `invoice-generation.html#prepaid`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Mở catalog | Người dùng mở Khoản thu | Header, toolbar, bảng và action có nhãn ngắn, dễ scan như ứng dụng quản lý thông thường. | Fact server/financial chỉ giữ helper text tối thiểu, không che mờ thao tác chính. |
| Xem trạng thái hoặc chi tiết | Mở states, rule hoặc PREPAID | Tiêu đề ngắn; chi tiết contract còn cần thiết nằm trong disclosure/notice ngắn. | Không bỏ warning về inactive, permission, snapshot hay Operation reconciliation. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:14-124` -- nguồn copy UI cần rút gọn; giữ markup, actions, links và finance facts.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:17` -- chỉ đổi nếu mô tả coverage không còn khớp sau khi đơn giản hóa nhãn.

## Tasks & Acceptance

**Execution:**
- [ ] `.../mockups/admin/receivable-configuration.html` -- Rút gọn copy trên header, toolbar, bảng, states, rule và PREPAID -- làm mockup giống bề mặt app vận hành hơn tài liệu kỹ thuật.
- [ ] `.../mockups/MOCKUP-COVERAGE.md` -- Cập nhật mô tả nếu cần -- giữ coverage đúng copy/cấu trúc cuối cùng.

**Acceptance Criteria:**
- Given reviewer mở Khoản thu, when quét viewport đầu tiên, then hiểu được danh sách, filter, đơn giá, trạng thái và action mà không đọc đoạn giải thích dài.
- Given reviewer mở rule, state hoặc PREPAID, when cần ngữ cảnh, then nhận được warning/fact ngắn nhưng các boundary server, immutable snapshot, capability và retry vẫn không bị hiểu sai.
- Given links và controls hiện có, when copy được thay, then target, keyboard reachability và HTML semantics không đổi.

## Design Notes

Ưu tiên noun/action ngắn và cột quen thuộc: `Tên khoản thu`, `Mã`, `Đơn giá`, `Nhóm`, `Trạng thái`, `Tùy chọn`. Copy mô tả đủ cho người thao tác trước; reason/policy chỉ xuất hiện khi mở details hoặc gặp trạng thái bất thường.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- expected: HTML hợp lệ.

**Manual checks:**
- Mở `mockups/admin/receivable-configuration.html`, kiểm tra copy ở vùng đầu trang đọc nhanh như ứng dụng quản lý khoản thu thông thường.
