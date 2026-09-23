---
title: 'Ghi nhận cấu hình database kiểm thử'
type: 'chore'
created: '2026-09-23'
status: 'done'
route: 'one-shot'
---

# Ghi nhận cấu hình database kiểm thử

## Intent

**Problem:** Agent có thể vô tình chạy test cần database với cấu hình phát triển trong `.env`.

**Approach:** Bổ sung chỉ dẫn repository rõ ràng: test cần database phải dùng cấu hình trong `.env.test` và không được dùng database phát triển.

## Suggested Review Order

- Xác nhận ràng buộc môi trường test được đặt ngoài vùng BMad tự quản lý.
  [`AGENTS.md:40`](../../AGENTS.md#L40)
