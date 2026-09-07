---
title: 'Việt hóa mockup PassionEdu'
type: 'chore'
created: '2026-09-07'
status: 'done'
route: 'one-shot'
---

# Việt hóa mockup PassionEdu

## Intent

**Problem:** Bộ mockup review dùng tiếng Việt không dấu và trộn thuật ngữ tiếng Anh, khiến nội dung không phù hợp để người dùng thật đánh giá luồng vận hành.

**Approach:** Chuẩn hóa toàn bộ nội dung hiển thị mới sang tiếng Việt tự nhiên có dấu, đồng thời sửa các dữ liệu minh họa và tương tác mockup mâu thuẫn được phát hiện khi rà soát.

## Suggested Review Order

**Điểm vào review**

- Mở từ danh mục đã Việt hóa để kiểm tra ba cổng thông tin và hướng dẫn review.
  [`review.html:11`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/review.html#L11)

- Đối chiếu ma trận bao phủ với các bề mặt và trạng thái đã mô phỏng.
  [`MOCKUP-COVERAGE.md:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L1)

**Luồng nghiệp vụ**

- Kiểm tra thuật ngữ, dữ liệu mẫu và các luồng Admin/Staff đã được Việt hóa.
  [`admin-staff.html:3`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html#L3)

- Kiểm tra ngôn ngữ và giới hạn nội dung dành cho phụ huynh.
  [`parent.html:3`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent.html#L3)

- Kiểm tra ngôn ngữ vận hành nền tảng và luồng khởi tạo trường.
  [`ops.html:3`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/ops.html#L3)

**Tương tác hỗ trợ**

- Kiểm tra xác nhận, quản lý tiêu điểm và đối soát thao tác trong hộp thoại.
  [`prototype.js:4`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L4)

## Verification

**Commands:**

- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript hợp lệ.
