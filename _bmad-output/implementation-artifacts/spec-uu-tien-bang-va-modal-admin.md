---
title: 'Ưu tiên bảng và modal trong Admin'
type: 'chore'
created: '2026-09-23'
status: 'done'
route: 'one-shot'
---

# Ưu tiên bảng và modal trong Admin

## Intent

**Problem:** Các màn hình Admin cần một quy ước trình bày nhất quán, tránh mở rộng form hoặc workspace phụ ngay trong trang danh sách.

**Approach:** Khẳng định bảng là bề mặt quản trị chính; thao tác nghiệp vụ có giới hạn dùng modal, với ngoại lệ rõ ràng cho control tại chỗ và workflow cần route riêng.

## Suggested Review Order

- Xác nhận ranh giới table-first, modal và route chuyên biệt của Admin.
  [`DESIGN.md:149`](../../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md#L149)
