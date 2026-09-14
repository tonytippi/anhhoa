---
title: 'Việt hóa copy điểm danh và bàn giao'
type: 'refactor'
created: '2026-09-14'
status: 'done'
route: 'one-shot'
---

# Việt hóa copy điểm danh và bàn giao

## Intent

**Problem:** Tab cấu hình và màn Trả trẻ còn dùng các từ tiếng Anh, thuật ngữ kỹ thuật và câu dài.

**Approach:** Dùng nhãn tiếng Việt ngắn, quen thuộc cho Giáo viên, Phụ huynh và Quản trị viên trường, nhưng giữ ranh giới xác nhận giờ trả, không tự tính phí và xóa ảnh sau hai tháng lịch.

## Suggested Review Order

**Copy vận hành**

- Hai cấu hình ảnh dùng tiếng Việt ngắn và nêu đúng quyền xem.
  [`school-settings.html:61`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L61)

- Màn trả trẻ giữ ngôn ngữ ngắn mà không thay đổi ranh giới nghiệp vụ.
  [`teacher.html:65`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html#L65)

**Bảo vệ regression**

- Settings test xác nhận copy thay đổi trạng thái vẫn nhất quán.
  [`test-school-settings-ux.mjs:104`](test-school-settings-ux.mjs#L104)

- Static và Teacher tests bảo vệ giờ đã xác nhận, retention và không tự tính phí.
  [`test-rendered-mockup-contracts.mjs:157`](test-rendered-mockup-contracts.mjs#L157)
  [`test-teacher-attendance-ux.mjs:198`](test-teacher-attendance-ux.mjs#L198)
