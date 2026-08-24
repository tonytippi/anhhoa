---
title: 'Cập nhật câu chữ đăng nhập Parent'
type: 'chore'
created: '2026-08-24'
status: 'done'
route: 'one-shot'
---

# Cập nhật câu chữ đăng nhập Parent

## Intent

**Problem:** Trang đăng nhập Parent hiển thị tên thương hiệu và tiêu đề cũ, không khớp với câu chữ được yêu cầu.

**Approach:** Đổi tên thương hiệu thành `Anh Hoa Preschool`, đổi tiêu đề thành `Đăng nhập`, và cập nhật kiểm thử giao diện tương ứng.

## Suggested Review Order

- Cập nhật nhãn thương hiệu và tiêu đề tại điểm vào đăng nhập.
  [`app.tsx:144`](../../apps/parent-web/src/app.tsx#L144)

- Xác nhận câu chữ mới hiển thị trong luồng chưa xác thực.
  [`app.test.tsx:7`](../../apps/parent-web/src/app.test.tsx#L7)
